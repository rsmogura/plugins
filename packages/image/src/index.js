import { readFileSync } from 'fs';
import { extname } from 'path';

import { createFilter } from '@rollup/pluginutils';

// The id of "virtual module", random number to reduce collision chances
const encoderVirtualModuleName = "$image-plugin-encoder-virtual-id"  + Math.ceil(Math.random() * 100000);

const defaults = {
  dom: false,
  exclude: null,
  include: null
};

const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

const escapeFunctionTemplate = `
  export function e(data) { return encodeURIComponent(data); };
`;

const domTemplate = ({ format, mime, source }) => `
  const img = new Image();
  const source = ${format === 'base64' ? `'${source}'` : `btoa('${source}')`};
  img.src = 'data:${mime};base64,' + source;
  export default img;
`;

const constTemplate = ({ format, mime, source }) => `
  import {e} from "${encoderVirtualModuleName}";
  const source = '${source}';
  const img = 'data:${mime};${format},' + ${format === 'base64' ? 'source' : 'e(source)'};
  export default img;
`;

export default function image(opts = {}) {
  const options = Object.assign({}, defaults, opts);
  const filter = createFilter(options.include, options.exclude);

  return {
    name: 'image',

    resolveId(id) {
      if (id === encoderVirtualModuleName) {
        return encoderVirtualModuleName;
      }

      return null;
    },

    load(id) {
      // Check if it's virtual import. This import is used to reduce size of generated JS
      // by sharing reference to encode function.
      if (id === encoderVirtualModuleName) {
        return escapeFunctionTemplate;
      }

      if (!filter(id)) {
        return null;
      }

      const mime = mimeTypes[extname(id)];
      if (!mime) {
        // not an image
        return null;
      }

      const isSvg = mime === mimeTypes['.svg'];
      const format = isSvg ? 'utf-8' : 'base64';
      const source = readFileSync(id, format).replace(/[\r\n]+/gm, '');
      const code = options.dom
        ? domTemplate({ format, mime, source })
        : constTemplate({ format, mime, source });

      return code.trim();
    }
  };
}
