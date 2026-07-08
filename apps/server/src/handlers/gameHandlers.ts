//here we choose words and hold who plays and stuff
//we have a list here   
const drawingWords: string[] = ["apple","house",
  "car",
  "tree",
  "sun",
  "cat",
  "dog",
  "cloud",
  "chair",
  "book",
  "pizza",
  "clock",
  "guitar",
  "banana",
  "star",
  "pencil",
  "fish",
  "cup",
  "bird",
  "elephant"
];
export function pickWords(): string[]{
    return drawingWords.sort(() => 0.5 - Math.random()).slice(0, 3);
}