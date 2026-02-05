// CardComponent.jsx (Updated with visibility)
import { useRef, useEffect } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export default function CardComponent({ frontUrl, backUrl, visible = true }) {
  const meshRef = useRef();
  const { camera, controls } = useThree();
  const targetRotation = useRef(new THREE.Euler(0, 0, 0));
  const isInteracting = useRef(false);

  const [frontTexture, backTexture] = useTexture([frontUrl, backUrl]);

  useEffect(() => {
    if (!controls) return;

    const handleStart = () => {
      isInteracting.current = true;
    };

    const handleEnd = () => {
      isInteracting.current = false;
      targetRotation.current.set(0, 0, 0);
    };

    controls.addEventListener('start', handleStart);
    controls.addEventListener('end', handleEnd);

    return () => {
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('end', handleEnd);
    };
  }, [controls]);

  useFrame(() => {
    if (!meshRef.current || isInteracting.current) return;

    meshRef.current.rotation.x = THREE.MathUtils.lerp(
      meshRef.current.rotation.x,
      targetRotation.current.x,
      0.1
    );
    meshRef.current.rotation.y = THREE.MathUtils.lerp(
      meshRef.current.rotation.y,
      targetRotation.current.y,
      0.1
    );
    meshRef.current.rotation.z = THREE.MathUtils.lerp(
      meshRef.current.rotation.z,
      targetRotation.current.z,
      0.1
    );
  });

  return (
    <mesh ref={meshRef} visible={visible}>
      <boxGeometry args={[3, 4.2, 0.05]} />
      <meshStandardMaterial attach="material-0" color="gray" />
      <meshStandardMaterial attach="material-1" color="gray" />
      <meshStandardMaterial attach="material-2" color="gray" />
      <meshStandardMaterial attach="material-3" color="gray" />
      <meshStandardMaterial attach="material-4" map={frontTexture} />
      <meshStandardMaterial attach="material-5" map={backTexture} />
    </mesh>
  );
}