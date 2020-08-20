import { BLOCK, SECTOR_SIZE } from './constants';
import { Image } from './image';
import { blockDecompressor, blockGenerator, ZeroStream } from './utils';

// Don't read comments or block map terminators
const EXCLUDE: BLOCK[] = [BLOCK.COMMENT, BLOCK.TERMINATOR];

export async function* readStream(image: Image, end: number) {
	// end is inclusive
	let remaining = end + 1;
	for (const { block } of blockGenerator(image, EXCLUDE)) {
		if (remaining <= 0) {
			return;
		}
		if (block.type === BLOCK.ZEROFILL || block.type === BLOCK.FREE) {
			const size = Math.min(block.sectorCount * SECTOR_SIZE, remaining);
			yield* new ZeroStream(size);
			remaining -= size;
		} else {
			const offset = image.footer!.dataForkOffset + block.compressedOffset;
			const length = block.compressedLength;
			const inputStream = await image.fs.createReadStream(
				offset,
				offset + length - 1,
			);
			for await (let chunk of blockDecompressor(block.type, inputStream)) {
				if (chunk.length > remaining) {
					chunk = chunk.slice(0, remaining);
				}
				yield chunk;
				remaining -= chunk.length;
			}
		}
	}
}
