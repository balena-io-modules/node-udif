import { BLOCK, SECTOR_SIZE } from './constants';
import { Image } from './image';
import { blockDecompressor, blockGenerator, ZeroStream } from './utils';

// Don't read comments or block map terminators
const EXCLUDE: BLOCK[] = [BLOCK.COMMENT, BLOCK.TERMINATOR];

export async function* readStream(image: Image) {
	for (const { block } of blockGenerator(image, EXCLUDE)) {
		if (block.type === BLOCK.ZEROFILL || block.type === BLOCK.FREE) {
			const size = block.sectorCount * SECTOR_SIZE;
			yield* new ZeroStream(size);
		} else {
			const offset = image.footer!.dataForkOffset + block.compressedOffset;
			const length = block.compressedLength;
			const inputStream = await image.fs.createReadStream(
				offset,
				offset + length - 1,
			);
			yield* blockDecompressor(block.type, inputStream);
		}
	}
}
