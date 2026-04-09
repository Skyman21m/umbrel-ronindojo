import readLine from "readline";
import fs from "fs";

export const tail = (fileName: string) => (numLines: number) => {
  return new Promise<string>((resolve) => {
    const buffer: string[] = [];

    const rl = readLine.createInterface({
      input: fs.createReadStream(fileName),
      terminal: false,
    });

    rl.on("line", (line) => {
      buffer.push(line);

      if (buffer.length > numLines) {
        buffer.shift();
      }
    });

    rl.on("close", () => {
      resolve(buffer.join("\n"));
    });
  });
};
