# Error-Correcting Codes

Tutorials and visualizations on how extra information makes errors detectable and correctable. We begin with barcodes and QR codes, then use linear algebra to construct Hamming codes and explain their limits.

## Tutorials

Recommended reading order: **Why Code? → Hamming Codes**.

| No. | Tutorial | Status | Read |
| --- | --- | --- | --- |
| 01 | Why Code? | Available | [PDF](tutorial_why_code/tutorial_why_code.pdf) |
| 02 | Hamming Codes: A Linear Algebra Tutorial | Available | [PDF](tutorial_Hamming_Code/tutorial_Hamming_Code.pdf) |
| 03 | Reed–Solomon Codes | In progress | — |

## Why Code?

This tutorial follows a barcode from a printed label to a product lookup, then explores how QR codes recover damaged messages. Using check-digit arithmetic, diagrams, and a simple straight-line recovery example, you will learn what redundancy adds and why detecting an error is different from correcting it.

## Hamming Codes: A Linear Algebra Tutorial

This tutorial constructs Hamming codes and shows how to encode a message, locate a single flipped bit, and establish correction limits. Using linear algebra over F₂—parity-check matrices, kernels, bases, and syndromes—alongside Hamming distance and geometric diagrams, you will learn why the construction works and when decoding can fail.

| Topic | Core idea and mathematical tools |
| --- | --- |
| 1. Position Labels and Parity Checks | Construct the check matrix from binary position labels, then use kernels and rank-nullity to determine the code’s dimension and number of codewords. |
| 2. Syndrome and Single-Error Decoding | Use matrix linearity over F₂ and standard basis vectors to show why a single flipped bit produces its position’s label as the syndrome. |
| 3. Encoding and Choosing Check Positions | Use bases and invertible column submatrices to identify valid check positions and solve uniquely for the check bits. |
| 4. Ambiguity, Weight, and Minimum Distance | Use syndrome collisions, Hamming weight, and linear subspace structure to explain decoding ambiguity and relate minimum distance to the smallest undetectable error. |
| 5. Minimum Distance from the Columns of H | Relate minimum distance to the smallest linearly dependent set of check-matrix columns and prove that Hamming codes have minimum distance three. |
| 6. Correction Radius and Hamming Balls | Use syndrome-map injectivity and weight inequalities to derive the condition d_min > 2t, then interpret guaranteed correction through disjoint Hamming balls. |
| 7. Counting Errors and the Hamming Bound | Count errors with binomial coefficients and compare disjoint ball volumes to derive the Hamming bound and show why Hamming codes are perfect. |
| 8. Information Bits and Correction Radius | Compare Hamming and repetition codes using dimension, minimum distance, and ball volumes to explain the tradeoff between information bits and correction radius. |
| Appendix A. Reading the Grid Figures | Connect the grid figures to the binary hypercube using an explicit coordinate map whose Manhattan distances equal Hamming distances. |

## Try it yourself

- [Barcode](https://acgcomrade.github.io/error-correcting-codes/why-code.html): see how a printed pattern becomes a product identifier, and how a check digit catches a misread.
- [QR code](https://acgcomrade.github.io/error-correcting-codes/qr-code.html): see how a square pattern becomes a message, how extra check bytes help recover damaged data, and why correction has limits.
- [Hamming(7,4)](https://acgcomrade.github.io/error-correcting-codes/): visualize encoding and syndrome decoding, and compare single-bit correction with failures under multiple bit flips.
