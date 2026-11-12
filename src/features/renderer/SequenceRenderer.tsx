import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { NotationEntry, ObjectLocation, Sequence, SimulationResult } from '../../domain/model';
import { getMainBeatDurationSeconds } from '../../domain/time/time-signature';
import {
  getCameraPanOffset,
  getHandPosition,
  getHandReachPosition,
  getObjectPosition,
  getPerformerAnchor,
  getPassMeetingPoint,
  getPerformerFacing,
  getTableFootprint,
  getTablePositionPosition,
  type Point3,
  type SceneLayout,
} from './geometry';

interface SequenceRendererProps {
  readonly sequence: Sequence;
  readonly simulation: SimulationResult;
  readonly onSelectHand: (performerId: string, hand: 'left' | 'right', beatId: string) => void;
}

interface HandVisual {
  readonly performerId: string;
  readonly hand: 'left' | 'right';
  readonly mesh: THREE.Mesh;
  readonly arm: THREE.Mesh;
}

interface SceneState {
  readonly sequence: Sequence;
  readonly simulation: SimulationResult;
  readonly playhead: number;
  readonly progress: number;
  readonly layout: SceneLayout;
  readonly onSelectHand: SequenceRendererProps['onSelectHand'];
}

const BALL_PALETTES = {
  classic: ['#3569bd', '#d97735', '#3a9278', '#bd5960', '#8765b5', '#c5a13b'],
  bright: ['#2478e8', '#ef8a25', '#27a66f', '#e34f72', '#8b5cf6', '#e1b52d'],
};

function vector(point: Point3): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function lerpPoint(from: Point3, to: Point3, progress: number): THREE.Vector3 {
  return vector(from).lerp(vector(to), progress);
}

function snapshotLocation(
  simulation: SimulationResult,
  beatId: string,
  phase: 'before' | 'after',
  ballId: string,
): ObjectLocation | undefined {
  const snapshot = simulation.snapshots.find((item) => item.at.beatId === beatId && item.phase === phase);
  return snapshot?.ballLocations[ballId as keyof typeof snapshot.ballLocations];
}

function makeMaterial(color: string, roughness = 0.72): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function getActionTargetPosition(
  sequence: Sequence,
  entry: NotationEntry,
  layout: SceneLayout,
): Point3 | undefined {
  const action = entry.action;
  if (action.type === 'LIFT' || action.type === 'LEAVE' || action.type === 'TAP' || action.type === 'BOUNCE') {
    if (action.target.kind === 'position') {
      const positionId = action.target.positionId;
      const position = sequence.positions.find((item) => item.id === positionId);
      if (!position) return undefined;
      if (position.kind === 'hand-back') return getHandPosition(sequence, position.performerId, position.hand, layout);
      return getTablePositionPosition(sequence, position, layout);
    }
    if (action.target.kind === 'circle-position') {
      const circleTarget = action.target;
      const performerIndex = sequence.performers.findIndex((item) => item.id === entry.performerId);
      const offset = circleTarget.direction
        ? (circleTarget.direction === 'left' ? -1 : 1) * (circleTarget.distance ?? 1)
        : 0;
      const targetIndex = (performerIndex + offset + sequence.performers.length) % sequence.performers.length;
      const targetPerformer = sequence.performers[targetIndex];
      const position = sequence.positions.find((item) =>
        item.kind === 'table' &&
        item.name === circleTarget.position &&
        (item.owner.kind === 'shared' || (item.owner.kind === 'performer' && item.owner.performerId === targetPerformer?.id)),
      );
      return position ? getTablePositionPosition(sequence, position, layout) : undefined;
    }
  }
  if (action.type === 'LEAVE' && action.target.kind === 'pass-recipient-hand') {
    return getPassMeetingPoint(
      sequence,
      entry.performerId,
      entry.hand,
      action.target.performerId,
      action.target.hand,
      layout,
    );
  }
  if (action.type === 'LIFT' && action.target.kind === 'pass-source' && action.linkId) {
    const source = sequence.notation.find((item) =>
      item.action.type === 'LEAVE' &&
      'linkId' in item.action &&
      item.action.linkId === action.linkId,
    );
    if (source) {
      return getPassMeetingPoint(
        sequence,
        source.performerId,
        source.hand,
        entry.performerId,
        entry.hand,
        layout,
      );
    }
  }
  return undefined;
}

export default function SequenceRenderer({ sequence, simulation, onSelectHand }: SequenceRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneStateRef = useRef<SceneState>({
    sequence,
    simulation,
    playhead: 0,
    progress: 0,
    layout: 'circle',
    onSelectHand,
  });
  const previousSequenceRef = useRef(sequence);
  const playheadRef = useRef(0);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepAnimating, setStepAnimating] = useState(false);
  const [tempo, setTempo] = useState(sequence.bpm);
  const [repeat, setRepeat] = useState(false);
  const [layout, setLayout] = useState<SceneLayout>('circle');
  const [palette, setPalette] = useState<keyof typeof BALL_PALETTES>('classic');

  playheadRef.current = playhead;
  sceneStateRef.current = { sequence, simulation, playhead, progress, layout, onSelectHand };

  useEffect(() => {
    setPlaying(false);
    setStepAnimating(false);
    setProgress(0);
    const previous = previousSequenceRef.current;
    if (previous !== sequence) {
      const previousBeat = previous.beats[playheadRef.current];
      const preservedIndex = previousBeat
        ? sequence.beats.findIndex((beat) => beat.id === previousBeat.id)
        : -1;
      if (preservedIndex >= 0) {
        setPlayhead(preservedIndex);
      } else {
        setPlayhead(Math.min(playheadRef.current, Math.max(0, sequence.beats.length - 1)));
      }
      previousSequenceRef.current = sequence;
    }
  }, [sequence]);

  useEffect(() => {
    if (!playing || !simulation.validation.isValid || !sequence.beats.length) return;
    let elapsed = 0;
    let previousTime = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      elapsed += now - previousTime;
      previousTime = now;
      const duration = getMainBeatDurationSeconds(sequence.timeSignature, playhead, tempo) * 1000;
      if (elapsed >= duration) {
        elapsed = 0;
        setProgress(0);
        setPlayhead((current) => {
          if (current >= sequence.beats.length - 1) {
            if (repeat) return 0;
            setPlaying(false);
            return current;
          }
          return current + 1;
        });
      } else {
        setProgress(Math.min(1, elapsed / duration));
      }
    }, 16);
    return () => window.clearInterval(timer);
  }, [playing, playhead, tempo, repeat, sequence, simulation.validation.isValid]);

  useEffect(() => {
    if (!stepAnimating) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const next = Math.min(1, (Date.now() - started) / 500);
      setProgress(next);
      if (next >= 1) {
        window.clearInterval(timer);
        setStepAnimating(false);
        setProgress(0);
      }
    }, 16);
    return () => window.clearInterval(timer);
  }, [stepAnimating]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f5f7fb');
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const target = new THREE.Vector3(0, 0.8, 0);
    let radius = 10.5;
    let theta = 0;
    let phi = 0.92;
    const updateCamera = () => {
      phi = Math.max(0.25, Math.min(1.48, phi));
      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.sin(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.cos(theta),
      );
      camera.lookAt(target);
    };
    updateCamera();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.className = 'renderer-canvas';
    renderer.domElement.style.touchAction = 'none';

    scene.add(new THREE.HemisphereLight('#ffffff', '#b8c5d8', 2.1));
    const sunlight = new THREE.DirectionalLight('#ffffff', 2.4);
    sunlight.position.set(-4, 8, 5);
    sunlight.castShadow = true;
    scene.add(sunlight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      makeMaterial('#e7edf6'),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.08;
    floor.receiveShadow = true;
    scene.add(floor);

    const footprint = getTableFootprint(sequence);
    const tableGeometry = footprint.round
      ? new THREE.CylinderGeometry(footprint.width / 2, footprint.width / 2, 0.08, footprint.sideCount ?? 48)
      : new THREE.BoxGeometry(footprint.width, 0.08, footprint.depth);
    const table = new THREE.Mesh(tableGeometry, makeMaterial('#b9c8db'));
    table.position.y = -0.04;
    if (footprint.round && footprint.sideCount) table.rotation.y = Math.PI / footprint.sideCount;
    table.castShadow = true;
    table.receiveShadow = true;
    scene.add(table);

    const tablePositions = sequence.positions.filter((position) => position.kind === 'table');
    for (const position of tablePositions) {
      const point = getTablePositionPosition(sequence, position, layout);
      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.025, 24),
        makeMaterial('#dce7f7'),
      );
      marker.position.copy(vector(point));
      marker.position.y = 0.015;
      scene.add(marker);
    }

    const handVisuals: HandVisual[] = [];
    for (const performer of sequence.performers) {
      const anchor = getPerformerAnchor(sequence, performer, layout);
      const facing = getPerformerFacing(sequence, performer, layout);
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.38, 1.15, 20),
        makeMaterial('#7d91ae'),
      );
      body.position.set(anchor.x, 0.58, anchor.z);
      body.rotation.y = Math.atan2(facing.x, facing.z);
      body.castShadow = true;
      scene.add(body);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.27, 24, 18),
        makeMaterial('#d9b89e'),
      );
      head.position.set(anchor.x, 1.42, anchor.z);
      head.castShadow = true;
      scene.add(head);

      for (const hand of ['left', 'right'] as const) {
        const handPoint = getHandPosition(sequence, performer.id, hand, layout);
        const handMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 20, 16),
          makeMaterial('#d9b89e'),
        );
        handMesh.position.copy(vector(handPoint));
        handMesh.castShadow = true;
        handMesh.userData = { performerId: performer.id, hand };
        scene.add(handMesh);

        const arm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.075, 0.095, 1, 12),
          makeMaterial('#7d91ae'),
        );
        arm.castShadow = true;
        scene.add(arm);
        handVisuals.push({ performerId: performer.id, hand, mesh: handMesh, arm });
      }
    }

    const balls = new Map<string, THREE.Mesh>();
    sequence.balls.forEach((ball, index) => {
      const material = makeMaterial(BALL_PALETTES[palette][index % BALL_PALETTES[palette].length]!);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 18), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      balls.set(ball.id, mesh);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerStart: { x: number; y: number; button: number } | null = null;
    let moved = false;
    const onPointerDown = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY, button: event.button };
      moved = false;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerStart) return;
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if (pointerStart.button === 2) {
        camera.updateMatrixWorld(true);
        const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        const cameraUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
        const offset = getCameraPanOffset(
          { x: cameraRight.x, y: cameraRight.y, z: cameraRight.z },
          { x: cameraUp.x, y: cameraUp.y, z: cameraUp.z },
          dx,
          dy,
          radius,
        );
        target.add(vector(offset));
      } else {
        theta -= dx * 0.008;
        phi += dy * 0.006;
      }
      pointerStart = { ...pointerStart, x: event.clientX, y: event.clientY };
      updateCamera();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!moved && pointerStart && pointerStart.button === 0) {
        const bounds = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
        pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const selected = raycaster.intersectObjects(handVisuals.map((item) => item.mesh), false)[0]?.object;
        const performerId = selected?.userData.performerId as string | undefined;
        const hand = selected?.userData.hand as 'left' | 'right' | undefined;
        const current = sceneStateRef.current;
        const beat = current.sequence.beats[current.playhead];
        if (current.simulation.validation.isValid && performerId && hand && beat) {
          current.onSelectHand(performerId, hand, beat.id);
        }
      }
      pointerStart = null;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      radius = Math.max(5.5, Math.min(19, radius + event.deltaY * 0.009));
      updateCamera();
    };
    const onContextMenu = (event: Event) => event.preventDefault();
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      const current = sceneStateRef.current;
      const beat = current.sequence.beats[current.playhead];
      const valid = current.simulation.validation.isValid;
      const progressValue = valid ? current.progress : 0;
      renderer.domElement.style.visibility = valid ? 'visible' : 'hidden';

      if (beat) {
        for (const ball of current.sequence.balls) {
          const before = snapshotLocation(current.simulation, beat.id, 'before', ball.id);
          const after = snapshotLocation(current.simulation, beat.id, 'after', ball.id);
          const from = getObjectPosition(current.sequence, before, current.layout);
          const to = getObjectPosition(current.sequence, after ?? before, current.layout);
          const mesh = balls.get(ball.id);
          if (mesh) mesh.position.copy(lerpPoint(from, to, progressValue));
        }

        for (const visual of handVisuals) {
          const base = getHandPosition(current.sequence, visual.performerId, visual.hand, current.layout);
          const entries = current.sequence.notation.filter((entry) =>
            entry.performerId === visual.performerId &&
            entry.hand === visual.hand &&
            entry.time.beatId === beat.id,
          );
          let targetPoint: Point3 | undefined;
          for (const entry of entries) {
            const action = entry.action;
            if (action.type === 'LIFT' || action.type === 'LEAVE' || action.type === 'TAP' || action.type === 'BOUNCE') {
              targetPoint = getActionTargetPosition(current.sequence, entry, current.layout);
            } else if (action.type === 'ZIP') {
              const otherHand = visual.hand === 'left' ? 'right' : 'left';
              const other = getHandPosition(current.sequence, visual.performerId, otherHand, current.layout);
              targetPoint = { x: (base.x + other.x) / 2, y: 1.25, z: (base.z + other.z) / 2 };
            } else if (action.type === 'SPECIAL') {
              const otherHand = visual.hand === 'left' ? 'right' : 'left';
              const other = getHandPosition(current.sequence, visual.performerId, otherHand, current.layout);
              targetPoint = { x: (base.x + other.x) / 2, y: 1.15, z: (base.z + other.z) / 2 };
            } else if (action.type === 'HOLD' || action.type === 'EMPTY') {
              targetPoint = undefined;
            }
          }
          const handPoint = targetPoint
            ? vector(getHandReachPosition(base, targetPoint, progressValue))
            : vector(base);
          visual.mesh.position.copy(handPoint);
          const performer = current.sequence.performers.find((item) => item.id === visual.performerId);
          if (performer) {
            const anchor = getPerformerAnchor(current.sequence, performer, current.layout);
            const facing = getPerformerFacing(current.sequence, performer, current.layout);
            const right = { x: -facing.z, y: 0, z: facing.x };
            const side = visual.hand === 'left' ? -1 : 1;
            const shoulder = vector({
              x: anchor.x + right.x * side * 0.22 + facing.x * 0.08,
              y: 0.91,
              z: anchor.z + right.z * side * 0.22 + facing.z * 0.08,
            });
            const direction = handPoint.clone().sub(shoulder);
            visual.arm.position.copy(shoulder.clone().add(handPoint).multiplyScalar(0.5));
            visual.arm.scale.y = direction.length();
            visual.arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
          }
        }

        for (const ball of current.sequence.balls) {
          const before = snapshotLocation(current.simulation, beat.id, 'before', ball.id);
          const after = snapshotLocation(current.simulation, beat.id, 'after', ball.id);
          if (!before || !after || before.kind !== after.kind) continue;
          if (before.kind === 'hand-held' && after.kind === 'hand-held' &&
              before.performerId === after.performerId && before.hand === after.hand) {
            const hand = handVisuals.find((item) => item.performerId === before.performerId && item.hand === before.hand);
            const mesh = balls.get(ball.id);
            if (hand && mesh) mesh.position.copy(hand.mesh.position);
          } else if (before.kind === 'hand-back' && after.kind === 'hand-back' &&
              before.positionId === after.positionId) {
            const hand = handVisuals.find((item) => item.performerId === before.performerId && item.hand === before.hand);
            const mesh = balls.get(ball.id);
            if (hand && mesh) mesh.position.copy(hand.mesh.position.clone().add(new THREE.Vector3(0, 0.18, 0)));
          }
        }
      }

        if (beat) {
          for (const ball of current.sequence.balls) {
            const before = snapshotLocation(current.simulation, beat.id, 'before', ball.id);
            const after = snapshotLocation(current.simulation, beat.id, 'after', ball.id);
            const mesh = balls.get(ball.id);
            if (!before || !after || !mesh) continue;

          if (before.kind === 'position' && after.kind === 'hand-held') {
            if (progressValue >= 0.5) {
              const hand = handVisuals.find((item) => item.performerId === after.performerId && item.hand === after.hand);
              if (hand) mesh.position.copy(hand.mesh.position);
            } else {
              mesh.position.copy(vector(getObjectPosition(current.sequence, before, current.layout)));
            }
          } else if (before.kind === 'hand-held' && after.kind === 'position') {
            if (progressValue <= 0.5) {
              const hand = handVisuals.find((item) => item.performerId === before.performerId && item.hand === before.hand);
              if (hand) mesh.position.copy(hand.mesh.position);
            } else {
              mesh.position.copy(vector(getObjectPosition(current.sequence, after, current.layout)));
            }
          }
        }

        }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement);
    };
  }, [sequence, layout, palette]);

  const valid = simulation.validation.isValid;
  const step = (direction: -1 | 1) => {
    if (!valid || !sequence.beats.length) return;
    setPlaying(false);
    setStepAnimating(false);
    setProgress(0);
    setPlayhead((current) => Math.max(0, Math.min(sequence.beats.length - 1, current + direction)));
    setStepAnimating(true);
  };

  return (
    <section className="renderer-panel" aria-label="Sequence renderer">
      <div className="renderer-toolbar">
        <div className="renderer-playback">
          <button type="button" onClick={() => setPlaying((value) => !value)} disabled={!valid || stepAnimating || !sequence.beats.length}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={() => step(-1)} disabled={!valid || playhead === 0}>Previous</button>
          <button type="button" onClick={() => step(1)} disabled={!valid || playhead >= sequence.beats.length - 1}>Next</button>
        </div>
        <label className="renderer-control">Beat
          <input type="range" min="0" max={Math.max(0, sequence.beats.length - 1)} value={playhead} onChange={(event) => {
            setPlaying(false);
            setStepAnimating(false);
            setProgress(0);
            setPlayhead(Number(event.target.value));
          }} />
          <output>{playhead + 1} / {sequence.beats.length}</output>
        </label>
        <label className="renderer-control">BPM
          <input type="number" min="20" max="400" value={tempo} onChange={(event) => setTempo(Math.max(20, Math.min(400, Number(event.target.value) || 20)))} />
        </label>
        <label className="renderer-control renderer-inline-control">
          <input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} />
          Repeat
        </label>
        <label className="renderer-control">Layout
          <select value={layout} onChange={(event) => setLayout(event.target.value as SceneLayout)}>
            <option value="circle">Circle</option>
            <option value="line">Line</option>
          </select>
        </label>
        <label className="renderer-control">Ball colours
          <select value={palette} onChange={(event) => setPalette(event.target.value as keyof typeof BALL_PALETTES)}>
            <option value="classic">Classic</option>
            <option value="bright">Bright</option>
          </select>
        </label>
      </div>
      {!valid && <div className="renderer-disabled" role="status">Rendering is disabled because the sequence has validation errors.</div>}
      <div className="renderer-viewport" ref={hostRef} aria-label="Interactive 3D juggling scene" />
      <p className="renderer-hint">Drag to rotate. Right drag to pan. Scroll to zoom. Select a hand to jump to its editor row.</p>
    </section>
  );
}
