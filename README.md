# Error-Correcting Codes

How can a few extra bits reveal not only that a message has changed, but also which bit to correct?

A growing collection of tutorials on error-correcting codes, starting with Hamming codes from a linear algebra perspective. Each topic has its own PDF; further tutorials will be added as they are completed.

## Tutorials

| Tutorial | Status | Read |
| --- | --- | --- |
| Hamming Codes: A Linear Algebra Tutorial | Available | [PDF](tutorial_draft_Hamming_01_1_02/tutorial_draft_Hamming_01_1_02.pdf) |
| Reed–Solomon Codes | Planned | — |

## Hamming Codes: A Linear Algebra Tutorial

This tutorial starts with binary position labels and parity-check matrices, constructs valid codewords as a kernel, and explains encoding through a choice of basis. It then uses Hamming distance and the geometry of Hamming balls to establish the limits of error detection and correction.

The prerequisites are vector spaces, linear maps, kernels, bases, invertibility, and the rank-nullity theorem. All vector and matrix arithmetic takes place over the binary field F₂.

The introduction motivates redundancy and distinguishes detecting corruption from recovering the original message. The fourteen sections build the argument in three stages.

### Constructing and using the code

| Section | Topic |
| --- | --- |
| 1. Representing bit strings and their positions | Work over F₂ and assign a binary vector label to each position. |
| 2. Turning position labels into parity checks | Build H, define the code as ker(H), and count information and check bits using rank-nullity. |
| 3. What the checks reveal about an error | Derive the syndrome s = Hy = He. |
| 4. Why every single-bit error can be located | Show that a single error selects a column of H, identifying its position. |
| 5. Why the conclusion requires the single-error assumption | Explain how multiple errors can share a syndrome and cause miscorrection. |
| 6. Choosing which positions hold check digits | Characterize valid check positions as a basis and derive p = H_P⁻¹H_Dd, with a worked seven-bit example. |

### Explaining the detection and correction limits

| Section | Topic |
| --- | --- |
| 7. Measuring errors with Hamming weight and distance | Distinguish the weight of a word from the distance between two words. |
| 8. Why nonzero codewords are exactly the undetectable error patterns | Identify the errors that preserve every parity check. |
| 9. Why minimum distance equals minimum nonzero weight | Prove the equality for linear codes and derive the guaranteed detection limit. |
| 10. Reading minimum distance from the columns of the check matrix | Connect minimum distance to the smallest dependent set of columns. |
| 11. Why correcting up to t errors requires minimum distance greater than 2t | Prove both directions of the unique-correction criterion. |

### Seeing the geometry and tradeoffs

| Section | Topic |
| --- | --- |
| 12. Hamming balls as sets of possible received words | Define balls and spheres, count their sizes, and connect disjoint balls to correction. |
| 13. A three-bit example bringing the arguments together | Examine the code {000, 111}, its syndromes, and overlapping correction regions. |
| 14. Word length, redundancy, and correction regions | Explain perfect radius-one packing, compare Hamming and repetition codes, and relate Hamming distance to the hypercube graph. |

## Try it yourself

The companion [Hamming(7,4) interactive page](https://acgcomrade.github.io/error-correcting-codes/) lets you tweak a binary message and its error probability, flip individual bits, and follow the matrix calculations. Play around with single and multiple errors to see when detection works, when correction succeeds, and when a valid output is still the wrong message.
