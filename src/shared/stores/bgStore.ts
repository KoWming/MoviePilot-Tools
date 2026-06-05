import { reactive } from 'vue';
import { getCustomBgConfig, getCustomBgImage, type CustomBgConfig } from '../customBg';

export const bgStore = reactive({
  enabled: false,
  blurEnabled: false,
  blur: 5,
  opacity: 0.5,
  url: '',
  image: ''
});

export async function loadBgStore() {
  const config = await getCustomBgConfig();
  const image = await getCustomBgImage();
  bgStore.enabled = config.enabled;
  bgStore.blurEnabled = config.blurEnabled;
  bgStore.blur = config.blur;
  bgStore.opacity = config.opacity;
  bgStore.url = config.url;
  bgStore.image = image;
}

export function updateBgStore(config: Partial<CustomBgConfig>, image?: string) {
  if (config.enabled !== undefined) bgStore.enabled = config.enabled;
  if (config.blurEnabled !== undefined) bgStore.blurEnabled = config.blurEnabled;
  if (config.blur !== undefined) bgStore.blur = config.blur;
  if (config.opacity !== undefined) bgStore.opacity = config.opacity;
  if (config.url !== undefined) bgStore.url = config.url;
  if (image !== undefined) bgStore.image = image;
}
