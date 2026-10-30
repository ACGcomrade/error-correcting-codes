# Local QR decoder

`jsQR.js` is the unmodified distribution of **jsQR 1.4.0** by the jsQR
contributors, licensed under Apache-2.0. Its full license is in
`jsQR.LICENSE`.

- Project: https://github.com/cozmo/jsQR
- Pinned source: https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js
- License source: https://cdn.jsdelivr.net/npm/jsqr@1.4.0/LICENSE

It decodes the actual pixels of each Why Code QR preset locally. The page
does not contact a CDN, access a camera, or upload images. The QR matrix is
precomputed; its optional reproduction script is
`../../tests/generate-why-code-qr.cjs`.
