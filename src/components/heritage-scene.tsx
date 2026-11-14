import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { Color, Group } from "three";
import { useTheme } from "@/lib/theme";

function tokenColor(name: string) {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return new Color();
  context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return new Color(`rgb(${r},${g},${b})`);
}

function Stitches({ reduced, onReady }: { reduced: boolean; onReady: () => void }) {
  const group = useRef<Group>(null);
  const ready = useRef(false);
  const time = useRef(0);
  const { theme } = useTheme();
  const colors = useMemo(() => [tokenColor("--primary"), tokenColor("--secondary"), tokenColor("--border")], [theme]);
  useFrame((state, delta) => {
    if (!ready.current) { ready.current = true; onReady(); }
    if (!group.current || reduced) return;
    time.current += Math.min(delta, 0.05);
    group.current.rotation.y = Math.sin(time.current * 0.2) * 0.14 + state.pointer.x * 0.06;
    group.current.rotation.x = Math.sin(time.current * 0.15) * 0.06;
  });
  return <>
    <ambientLight intensity={0.8} />
    <directionalLight position={[3, 4, 6]} intensity={2.5} />
    <Environment resolution={32}>
      <Lightformer intensity={2} position={[0, 5, 3]} scale={[10, 10, 1]} />
      <Lightformer intensity={1} position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
    </Environment>
    <group ref={group} rotation={[0.12, -0.22, 0.12]} position={[2.9, 1.4, 0]}>
      {Array.from({ length: 25 }, (_, i) => {
        const x = i % 5; const y = Math.floor(i / 5);
        return <group key={i} position={[(x - 2) * 0.66, (y - 2) * 0.66, Math.sin(x + y) * 0.12]}>
          {[-1, 1].map(sign => <mesh key={sign} rotation-z={sign * Math.PI / 4}>
            <boxGeometry args={[0.56, 0.085, 0.12]} />
            <meshStandardMaterial color={colors[(x + y) % 3] ?? colors[0] ?? new Color()} roughness={0.46} metalness={0.22} />
          </mesh>)}
        </group>;
      })}
    </group>
  </>;
}

export default function HeritageScene() {
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return <div className="heritage-scene" aria-hidden="true" data-scene-ready={ready || undefined}>
    <Canvas camera={{ position: [0, 0, 10], fov: 40 }} dpr={[1, 1.25]} frameloop={reduced ? "demand" : "always"} gl={{ alpha: true, antialias: true }}>
      <Stitches reduced={reduced} onReady={() => setReady(true)} />
    </Canvas>
  </div>;
}