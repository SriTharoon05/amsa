import { Scene, Color, Mesh, PlaneGeometry, MeshBasicMaterial, type Object3D, type Texture, type Material, type BufferGeometry } from 'three';

export function createStudioEnvironment() {
  const studio = new Scene(); studio.background = new Color(0x797c73);
  const panels: [number, number, number, number, number, number][] = [
    [-4, 1.2, 4, 1.05, 6, 5], [4, .8, 3.5, .7, 5.5, 4],
    [-1.6, 5, -1, 4, 2, 3], [0, 1, -5, 3.3, 4.8, 2.5], [0, 5.5, 1.5, 4.5, 2.5, 2],
  ];
  panels.forEach(([x, y, z, width, height, intensity]) => {
    const panel = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ color: new Color(0xfff9ef).multiplyScalar(intensity), toneMapped: false }));
    panel.position.set(x, y, z); panel.lookAt(0, 0, 0); studio.add(panel);
  });
  [-1, 1].forEach(side => {
    const flag = new Mesh(new PlaneGeometry(1.4, 7), new MeshBasicMaterial({ color: 0x1c211b, toneMapped: false }));
    flag.position.set(side * 3.8, 1, -.2); flag.lookAt(0, 0, 0); studio.add(flag);
  });
  return studio;
}

export function disposeSceneResources(objects: Object3D[]) {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>();
  objects.forEach(object => object.traverse(child => {
    if (!(child instanceof Mesh)) return;
    geometries.add(child.geometry);
    (Array.isArray(child.material) ? child.material : [child.material]).forEach(material => {
      materials.add(material);
      Object.values(material).forEach(value => { if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture); });
    });
  }));
  textures.forEach(texture => {
    const source = texture.source?.data as { close?: () => void } | undefined;
    if (!texture.userData.sharedBitmap && typeof source?.close === 'function') source.close();
    texture.dispose();
  });
  materials.forEach(material => material.dispose()); geometries.forEach(geometry => geometry.dispose());
}
