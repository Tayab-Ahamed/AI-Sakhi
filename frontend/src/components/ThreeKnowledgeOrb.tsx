"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";

type Props = {
  className?: string;
  interactive?: boolean;
};

const emptySubscribe = () => () => {};

export default function ThreeKnowledgeOrb({ className = "", interactive = true }: Props) {
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    if (!isMounted || !hasWebGL) return;
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    // 1. Let Three.js create its own fresh WebGL canvas internally
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "default",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.className = "w-full h-full block cursor-grab active:cursor-grabbing";
      container.appendChild(renderer.domElement);
    } catch {
      Promise.resolve().then(() => setHasWebGL(false));
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
    camera.position.z = 8.5;

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const emeraldLight = new THREE.PointLight(0x10b981, 35, 20);
    emeraldLight.position.set(4, 5, 4);
    scene.add(emeraldLight);

    const cyanRimLight = new THREE.PointLight(0x06b6d4, 25, 20);
    cyanRimLight.position.set(-4, -3, -4);
    scene.add(cyanRimLight);

    const goldAccentLight = new THREE.PointLight(0xf59e0b, 18, 20);
    goldAccentLight.position.set(0, -4, 3);
    scene.add(goldAccentLight);

    // 3. Central Knowledge Orb Group
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // Solid multifaceted core
    const coreGeo = new THREE.IcosahedronGeometry(1.25, 2);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x064e3b,
      emissive: 0x059669,
      emissiveIntensity: 0.6,
      roughness: 0.12,
      metalness: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(coreMesh);

    // Holographic wireframe lattice shell
    const wireGeo = new THREE.IcosahedronGeometry(1.36, 1);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x6ee7b7,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    coreGroup.add(wireMesh);

    // 4. Concentric Curricular Gimbal Orbit Rings
    // Ring 1: Math / Logic (Indigo)
    const ring1Geo = new THREE.TorusGeometry(2.1, 0.024, 16, 120);
    const ring1Mat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      emissive: 0x4f46e5,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.8,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    scene.add(ring1);

    const node1Geo = new THREE.SphereGeometry(0.1, 16, 16);
    const node1Mat = new THREE.MeshBasicMaterial({ color: 0x818cf8 });
    const node1 = new THREE.Mesh(node1Geo, node1Mat);
    ring1.add(node1);
    node1.position.set(2.1, 0, 0);

    // Ring 2: Science / Nature (Emerald)
    const ring2Geo = new THREE.TorusGeometry(2.7, 0.024, 16, 120);
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.y = Math.PI / 4;
    ring2.rotation.z = Math.PI / 6;
    scene.add(ring2);

    const node2Geo = new THREE.SphereGeometry(0.12, 16, 16);
    const node2Mat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
    const node2 = new THREE.Mesh(node2Geo, node2Mat);
    ring2.add(node2);
    node2.position.set(0, 2.7, 0);

    // Ring 3: Humanities / Language (Amber)
    const ring3Geo = new THREE.TorusGeometry(3.3, 0.024, 16, 120);
    const ring3Mat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.8,
    });
    const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
    ring3.rotation.x = -Math.PI / 4;
    ring3.rotation.z = Math.PI / 3;
    scene.add(ring3);

    const node3Geo = new THREE.SphereGeometry(0.11, 16, 16);
    const node3Mat = new THREE.MeshBasicMaterial({ color: 0xfcd34d });
    const node3 = new THREE.Mesh(node3Geo, node3Mat);
    ring3.add(node3);
    node3.position.set(-3.3, 0, 0);

    // 5. Ambient Stardust Particle Field
    const particleCount = 240;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const radius = 1.8 + Math.random() * 2.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.048,
      color: 0x6ee7b7,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const particleField = new THREE.Points(particleGeo, particleMat);
    scene.add(particleField);

    // 6. Interaction / Mouse Tilt Physics
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;

    const handlePointerMove = (e: PointerEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetRotY = x * 0.75;
      targetRotX = y * 0.55;
    };

    const handlePointerLeave = () => {
      targetRotX = 0;
      targetRotY = 0;
    };

    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerleave", handlePointerLeave);

    // 7. Responsive Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    // 8. Animation Loop
    let animationFrameId: number;
    const startTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startTime) * 0.001;

      currentRotX += (targetRotX - currentRotX) * 0.05;
      currentRotY += (targetRotY - currentRotY) * 0.05;

      coreGroup.rotation.x = currentRotX + Math.sin(elapsed * 0.8) * 0.1;
      coreGroup.rotation.y = currentRotY + elapsed * 0.45;

      wireMesh.rotation.y = -elapsed * 0.35;
      wireMesh.rotation.z = elapsed * 0.2;

      ring1.rotation.z += 0.008;
      ring1.rotation.y += 0.004;

      ring2.rotation.x += 0.006;
      ring2.rotation.z -= 0.007;

      ring3.rotation.y -= 0.005;
      ring3.rotation.x += 0.007;

      particleField.rotation.y = elapsed * 0.04;
      particleField.rotation.x = Math.sin(elapsed * 0.05) * 0.08;

      const pulse = 1 + Math.sin(elapsed * 2.2) * 0.15;
      emeraldLight.intensity = 35 * pulse;
      coreMat.emissiveIntensity = 0.5 + Math.sin(elapsed * 2.2) * 0.25;

      renderer.render(scene, camera);
    };

    animate();

    // 9. Cleanup and disposal
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerleave", handlePointerLeave);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isMounted, hasWebGL, interactive]);

  if (!isMounted || !hasWebGL) {
    return (
      <div
        className={`relative w-full h-full flex items-center justify-center rounded-3xl overflow-hidden p-6 select-none ${className}`}
        style={{ minHeight: 380, perspective: "1000px" }}
      >
        {/* Animated concentric 3D orbit rings in CSS */}
        <div className="relative w-64 h-64 flex items-center justify-center" style={{ transformStyle: "preserve-3d" }}>
          {/* Central glowing core */}
          <div className="absolute w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-400 to-emerald-300 shadow-[0_0_50px_rgba(16,185,129,0.7)] flex items-center justify-center animate-pulse">
            <span className="text-3xl select-none">🌸</span>
          </div>

          {/* Ring 1 - Mathematics / Indigo */}
          <div
            className="absolute w-44 h-44 rounded-full border-2 border-indigo-400/50 shadow-[0_0_20px_rgba(99,102,241,0.3)] animate-spin"
            style={{ animationDuration: "14s", transform: "rotateX(65deg) rotateY(20deg)" }}
          >
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-indigo-300 shadow-[0_0_10px_#818cf8]" />
          </div>

          {/* Ring 2 - Science / Emerald */}
          <div
            className="absolute w-56 h-56 rounded-full border-2 border-emerald-400/60 shadow-[0_0_24px_rgba(16,185,129,0.35)] animate-spin"
            style={{ animationDuration: "10s", animationDirection: "reverse", transform: "rotateY(60deg) rotateX(25deg)" }}
          >
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-emerald-200 shadow-[0_0_12px_#34d399]" />
          </div>

          {/* Ring 3 - Humanities / Amber */}
          <div
            className="absolute w-64 h-64 rounded-full border-2 border-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-spin"
            style={{ animationDuration: "18s", transform: "rotateX(40deg) rotateY(70deg)" }}
          >
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-amber-200 shadow-[0_0_10px_#fcd34d]" />
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[10px] font-bold tracking-wider uppercase text-emerald-400">
          Kinetic Knowledge Core
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center select-none ${className}`}
      style={{ minHeight: 380, touchAction: "none" }}
    />
  );
}
