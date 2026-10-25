// Fills the decorative mosaic behind the hero. The page reads the same without it.
for (const mosaic of document.querySelectorAll('.mosaic')) {
  for (let i = 0; i < 240; i += 1) mosaic.append(document.createElement('span'));
}
