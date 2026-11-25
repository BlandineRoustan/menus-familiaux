// Génère icons/icon-192.png et icons/icon-512.png (assiette crème sur fond vert sapin), sans dépendance.
// node tools/icones.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const SAPIN = hex('#1f4d3a'), CREME = hex('#fbf3e6'), ORANGE = hex('#f2b27f'), FEUILLE = hex('#2f6a51'), NERVURE = hex('#e2ece4');

// Couleur au point (x, y) dans [0, 1]² ; toutes les formes restent dans le cercle central (icône « maskable »).
function couleur(x, y) {
  const dx = x - .5, dy = y - .5, r = Math.hypot(dx, dy);
  // feuille : ellipse inclinée à 45°, au centre de l'assiette
  const a = -Math.PI / 4, u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a);
  const feuille = (u / .15) ** 2 + (v / .075) ** 2 <= 1;
  if (feuille) return Math.abs(v) < .006 && Math.abs(u) < .12 ? NERVURE : FEUILLE;
  if (r <= .215) return CREME;
  if (r <= .245) return ORANGE;
  if (r <= .32) return CREME;
  return SAPIN;
}

function png(taille) {
  const S = 4; // sur-échantillonnage pour lisser les bords
  const lignes = Buffer.alloc(taille * (taille * 3 + 1));
  for (let y = 0; y < taille; y++) {
    lignes[y * (taille * 3 + 1)] = 0;
    for (let x = 0; x < taille; x++) {
      const somme = [0, 0, 0];
      for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
        const c = couleur((x + (i + .5) / S) / taille, (y + (j + .5) / S) / taille);
        somme[0] += c[0]; somme[1] += c[1]; somme[2] += c[2];
      }
      const o = y * (taille * 3 + 1) + 1 + x * 3;
      for (let k = 0; k < 3; k++) lignes[o + k] = Math.round(somme[k] / (S * S));
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const bloc = (type, data) => {
    const t = Buffer.concat([Buffer.from(type), data]);
    const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(t));
    return Buffer.concat([l, t, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0); ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RVB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloc('IHDR', ihdr), bloc('IDAT', deflateSync(lignes)), bloc('IEND', Buffer.alloc(0))
  ]);
}

mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
for (const t of [192, 512]) writeFileSync(new URL(`../icons/icon-${t}.png`, import.meta.url), png(t));
console.log('icons/icon-192.png et icons/icon-512.png générées');
