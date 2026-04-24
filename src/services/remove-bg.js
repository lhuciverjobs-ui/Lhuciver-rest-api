const { removeBackground } = require('@imgly/background-removal-node');

async function removeImageBackground(buffer, mimetype) {
  const blob = new Blob([buffer], { type: mimetype });
  const output = await removeBackground(blob, {
    model: 'small',
    output: {
      format: 'image/png',
      type: 'foreground'
    }
  });
  const arrayBuffer = await output.arrayBuffer();

  return Buffer.from(arrayBuffer);
}

module.exports = {
  removeImageBackground
};
