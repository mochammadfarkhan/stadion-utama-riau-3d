/**
 * Cangkang stadion: rib ACP + selembayung, atap Kalzip oval + listplank,
 * truss baja, dinding concourse + kolom + pelat + tangga.
 * Origin = pusat lapangan, sumbu panjang = Z, utara = −Z.
 */
import { Group } from 'three';
import { createShellBase } from './ShellBase.js';
import { createRibs } from './ShellRibs.js';
import { createRoof } from './ShellRoof.js';
import { createTruss } from './ShellTruss.js';

/**
 * @param {{ribs?:boolean, roof?:boolean, truss?:boolean, base?:boolean, ribCount?:number, listplank?:boolean}} opts
 * @returns {Group}
 */
export function createShell({ ribs = true, roof = true, truss = true, base = true, ribCount, listplank = true } = {}) {
  const group = new Group();
  group.name = 'stadium-shell';
  if (base) group.add(createShellBase());
  if (ribs) group.add(createRibs(ribCount ? { count: ribCount } : {}));
  if (roof) group.add(createRoof({ listplank }));
  if (truss) group.add(createTruss());
  return group;
}
