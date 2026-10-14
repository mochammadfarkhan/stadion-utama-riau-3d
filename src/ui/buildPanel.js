import { SETTINGS_SCHEMA } from '../settings/schema.js';
import { callHook } from './dom.js';

/** Ikon folder per section (fallback 'layers'). */
const SECTION_ICONS = Object.freeze({
  sun: 'sun', atmosphere: 'cloud', rain: 'rain', quality: 'sparkle',
  view: 'eye', mix: 'speaker', stats: 'gauge',
});

/**
 * Bangun tab/folder/kontrol dari SETTINGS_SCHEMA secara otomatis.
 * extras: { timeOfDayCtor?: class (untuk widget 'sunArc'), afterBuild?: (tabs, panel) => void }
 * Mengembalikan { tabs: { [groupId]: Tab } }.
 */
export function buildSettingsPanel({ store, panel, extras = {}, schema = SETTINGS_SCHEMA }) {
  if (!store || !panel) throw new Error('buildSettingsPanel: `store` dan `panel` wajib diberikan');
  const tabs = {};
  for (const [groupId, group] of Object.entries(schema)) {
    const tab = panel.addTab(groupId, group.title, group.icon);
    for (const [sectionId, section] of Object.entries(group.sections)) {
      const folder = tab.addFolder(section.title, {
        id: `${groupId}.${sectionId}`,
        icon: SECTION_ICONS[sectionId] ?? group.icon ?? 'layers',
      });
      for (const [fieldId, field] of Object.entries(section.fields)) {
        addFieldControl(folder, `${groupId}.${fieldId}`, field, extras);
      }
    }
    tabs[groupId] = tab;
  }
  callHook(extras.afterBuild, tabs, panel);
  return { tabs };
}

/** Pilih kontrol berdasarkan type/widget field; kembalikan kontrol yang dibuat. */
export function addFieldControl(container, key, field, extras = {}) {
  if (field.widget === 'sunArc' && typeof extras.timeOfDayCtor === 'function') {
    return container.addCustom(extras.timeOfDayCtor, { key, field });
  }
  switch (field.type) {
    case 'toggle': return container.addToggle(key);
    case 'select': return container.addSelect(key);
    case 'range': return container.addSlider(key);
    default: throw new Error(`buildSettingsPanel: tipe field tidak dikenal "${field.type}" (${key})`);
  }
}
