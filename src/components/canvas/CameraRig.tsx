import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useRigStore } from '../../store/useRigStore';

/**
 * Camera Rig with Fixed 360-Degree Free Orbit:
 * - User manual rotation stays EXACTLY where cursor is released (no snapping back!)
 * - Camera lerps ONLY when explicitly clicking view preset buttons
 * - Subsea floor collision boundary (never clips below -118.5m)
 */
export const CameraRig: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, gl } = useThree();
  const cameraViewMode = useRigStore((s) => s.cameraViewMode);

  const targetCamPos = useRef(new THREE.Vector3(45, 25, 55));
  const targetLookAt = useRef(new THREE.Vector3(0, 5, 0));
  const isTransitioning = useRef(false);
  const isUserInteracting = useRef(false);
  const transitionSpeed = useRef(3.2);
  const prevModeRef = useRef<string>(cameraViewMode);

  // Stop any transition immediately when user touches/drags mouse or trackpad
  useEffect(() => {
    const onUserStart = () => {
      isUserInteracting.current = true;
      isTransitioning.current = false;
      if (controlsRef.current) {
        targetCamPos.current.copy(camera.position);
        targetLookAt.current.copy(controlsRef.current.target);
      }
    };
    const onUserEnd = () => {
      isUserInteracting.current = false;
      isTransitioning.current = false;
      if (controlsRef.current) {
        targetCamPos.current.copy(camera.position);
        targetLookAt.current.copy(controlsRef.current.target);
      }
    };

    const domElement = gl.domElement;
    domElement.addEventListener('pointerdown', onUserStart);
    domElement.addEventListener('pointerup', onUserEnd);
    domElement.addEventListener('pointercancel', onUserEnd);
    domElement.addEventListener('wheel', onUserStart, { passive: true });
    domElement.addEventListener('touchstart', onUserStart, { passive: true });
    domElement.addEventListener('touchend', onUserEnd, { passive: true });

    return () => {
      domElement.removeEventListener('pointerdown', onUserStart);
      domElement.removeEventListener('pointerup', onUserEnd);
      domElement.removeEventListener('pointercancel', onUserEnd);
      domElement.removeEventListener('wheel', onUserStart);
      domElement.removeEventListener('touchstart', onUserStart);
      domElement.removeEventListener('touchend', onUserEnd);
    };
  }, [gl.domElement, camera]);

  // Trigger smooth transition ONLY on explicit camera preset change
  useEffect(() => {
    if (prevModeRef.current === cameraViewMode) return;
    prevModeRef.current = cameraViewMode;

    if (cameraViewMode === 'free') {
      isTransitioning.current = false;
      return;
    }

    isTransitioning.current = true;

    if (cameraViewMode === 'topside') {
      targetCamPos.current.set(45, 28, 55);
      targetLookAt.current.set(0, 10, 0);
      transitionSpeed.current = 3.2;
    } else if (cameraViewMode === 'subsea') {
      targetCamPos.current.set(36, -22, 48);
      targetLookAt.current.set(0, -15, 0);
      transitionSpeed.current = 2.8;
    } else if (cameraViewMode === 'manifold') {
      targetCamPos.current.set(22, -8, 26);
      targetLookAt.current.set(0, -10.5, 0);
      transitionSpeed.current = 3.5;
    } else if (cameraViewMode === 'riser' || cameraViewMode === 'pipe1') {
      targetCamPos.current.set(-16, -12, 22);
      targetLookAt.current.set(-12, -22, -2);
      transitionSpeed.current = 3.5;
    } else if (cameraViewMode === 'pipe1_slice') {
      targetCamPos.current.set(-8, -6, 18);
      targetLookAt.current.set(-14, -8, 12);
      transitionSpeed.current = 4.0;
    } else if (cameraViewMode === 'split') {
      targetCamPos.current.set(58, 35, 68);
      targetLookAt.current.set(0, 0, 0);
      transitionSpeed.current = 2.8;
    } else if (cameraViewMode === 'part_detail') {
      targetCamPos.current.set(20, 5, 25);
      targetLookAt.current.set(0, 0, 0);
      transitionSpeed.current = 3.8;
    }
  }, [cameraViewMode]);

  useFrame((_, delta) => {
    if (controlsRef.current) {
      // Prevent penetrating below bedrock bottom
      if (camera.position.y < -110) {
        camera.position.y = -110;
      }

      // Only lerp if user is NOT interacting and a transition was explicitly requested
      if (isTransitioning.current && !isUserInteracting.current) {
        const factor = Math.min(1.0, delta * transitionSpeed.current);
        camera.position.lerp(targetCamPos.current, factor);
        controlsRef.current.target.lerp(targetLookAt.current, factor);

        if (
          camera.position.distanceTo(targetCamPos.current) < 0.15 &&
          controlsRef.current.target.distanceTo(targetLookAt.current) < 0.15
        ) {
          isTransitioning.current = false;
        }
      }

      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      minDistance={3}
      maxDistance={400}
      maxPolarAngle={Math.PI / 2 + 0.45}
      rotateSpeed={0.85}
      zoomSpeed={1.0}
      panSpeed={0.8}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
};
