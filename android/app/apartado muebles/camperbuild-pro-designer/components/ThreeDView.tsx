
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { InteractivePiece } from '../types';

interface ThreeDViewProps {
  pieces: InteractivePiece[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export const ThreeDView: React.FC<ThreeDViewProps> = ({ pieces, selectedId, onSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    group: THREE.Group;
    controls: OrbitControls;
    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(2000, 2000, 2000);
    scene.add(dirLight);

    const group = new THREE.Group();
    scene.add(group);

    sceneRef.current = { scene, camera, renderer, group, controls, raycaster, mouse };

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current || !sceneRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      sceneRef.current.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      sceneRef.current.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      sceneRef.current.raycaster.setFromCamera(sceneRef.current.mouse, sceneRef.current.camera);
      const intersects = sceneRef.current.raycaster.intersectObjects(sceneRef.current.group.children);
      if (intersects.length > 0) onSelect(intersects[0].object.userData.id);
      else onSelect(null);
    };

    containerRef.current.addEventListener('mousedown', handleClick);
    camera.position.set(1000, 1000, 1000);
    controls.target.set(400, 350, 200);

    return () => {
      renderer.dispose();
      if (containerRef.current) containerRef.current.removeEventListener('mousedown', handleClick);
    };
  }, [onSelect]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const { group } = sceneRef.current;
    while (group.children.length > 0) group.remove(group.children[0]);

    const woodMaterial = (id: string, type: string) => {
      const isSelected = selectedId === id;
      const color = isSelected ? 0x3b82f6 : (type === 'frontal' ? 0x60a5fa : 0xe2e8f0);
      return new THREE.MeshStandardMaterial({ 
        color,
        emissive: isSelected ? 0x3b82f6 : 0x000000,
        emissiveIntensity: 0.2,
        roughness: 0.7
      });
    };

    pieces.forEach(p => {
      const geo = new THREE.BoxGeometry(p.w, p.h, p.d);
      const mesh = new THREE.Mesh(geo, woodMaterial(p.id, p.type));
      // Posición basada en el centro de la pieza para Three.js
      mesh.position.set(p.x + p.w/2, p.y + p.h/2, p.z + p.d/2);
      mesh.userData = { id: p.id };
      
      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.5 }));
      mesh.add(line);
      
      group.add(mesh);
    });

  }, [pieces, selectedId]);

  return (
    <div className="bg-slate-900 rounded-[40px] shadow-2xl border border-slate-800 flex flex-col items-center justify-center min-h-[600px] relative overflow-hidden group">
      <div className="absolute top-6 left-8 z-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] pointer-events-none bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-700">Visor 3D Interactivo</div>
      <div ref={containerRef} className="w-full h-full absolute inset-0 cursor-pointer" />
    </div>
  );
};
