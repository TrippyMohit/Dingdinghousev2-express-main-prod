"use strict";
//
// export default function getRandomMatrix(
//   {
//     x:number,
//     y:number,
//   }
// ): number[][] {
//   const matrix: number[][] = [];
//   const resultMatrix: number[][] = [];
//
//   // First create and shuffle the full reels
//   for (let i = 0; i < this.config.content.matrix.x; i++) {
//     const row: string[] = [];
//
//     // Fill row with symbols based on reelsInstance
//     this.config.content.symbols.forEach((symbol) => {
//       for (let j = 0; j < symbol.reelsInstance[i]; j++) {
//         row.push(symbol.id.toString());
//       }
//     });
//
//     // Shuffle the row before adding to matrix
//     const shuffledRow = this.shuffleArray([...row]);
//     matrix.push(shuffledRow);
//   }
//
//   // Now get random visible segments from each reel
//   for (let i = 0; i < matrix.length; i++) {
//     const reel = matrix[i];
//     const visibleSymbols: number[] = [];
//
//     // Get random starting index
//     const startIdx = Math.floor(
//       Math.random() * (reel.length - this.config.content.matrix.y)
//     );
//
//     // Get Y consecutive symbols from the random starting point
//     for (let j = 0; j < this.config.content.matrix.y; j++) {
//       visibleSymbols.push(reel[(startIdx + j) % reel.length]);
//     }
//
//     resultMatrix.push(visibleSymbols);
//   }
//
//   return resultMatrix[0].map((_, colIndex) =>
//     matrix.map((row) => row[colIndex])
//   );
// }
