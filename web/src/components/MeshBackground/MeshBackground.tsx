import blobBlue from "@/assets/background/mesh-blob-blue.svg";
import blobCanvas from "@/assets/background/mesh-blob-canvas.svg";
import blobOrange from "@/assets/background/mesh-blob-orange.svg";
import blobYellowWide from "@/assets/background/mesh-blob-yellow-wide.svg";
import blobYellow from "@/assets/background/mesh-blob-yellow.svg";

/*
  Figma `BG/MeshGradient` — 흐린 원(blob) 6개 + 흰 베일.
  blur 는 SVG 안(feGaussianBlur)에 들어 있으므로 이미지를 그대로 씁니다.
  좌표는 Figma 절대 좌표 데이터라서 Tailwind 임의값 클래스 대신 style 로 둡니다.
*/
const BLOBS = [
  { src: blobYellow, left: 392, top: -338 },
  { src: blobBlue, left: -400, top: -389 },
  { src: blobOrange, left: -100, top: 249 },
  { src: blobOrange, left: 657, top: -133 },
  { src: blobYellowWide, left: -354, top: 210 },
  { src: blobCanvas, left: 536, top: 249 },
] as const;

export default function MeshBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
      {BLOBS.map((blob, index) => (
        <img
          key={index}
          src={blob.src}
          alt=""
          className="absolute max-w-none"
          style={{ left: blob.left, top: blob.top }}
        />
      ))}
      <div className="absolute inset-0 bg-veil" />
    </div>
  );
}
