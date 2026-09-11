import React from 'react';
import { useRigStore } from '../../store/useRigStore';
import { CustomObjRig } from './CustomObjRig';

/**
 * 3D Oil Rig & Subsea Diorama Model
 * Renders the custom Blender diorama with exact component color coding,
 * extended seabed terrain, and direct mesh raycast voice diagnostics.
 */
export const OilRigModel: React.FC = () => {
  const customObjUrl = useRigStore((s) => s.customObjUrl) || '/models/untitled.obj';

  return (
    <group position={[0, 0, 0]}>
      <CustomObjRig objUrl={customObjUrl} />
    </group>
  );
};
