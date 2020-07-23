import { BLOCK, SECTOR_SIZE } from './constants';
import { Image } from './image';
import { blockDecompressor, blockGenerator, ZeroStream } from './utils';

const EXCLUDE = [
	// Don't read comments or block map terminators
	BLOCK.COMMENT,
	BLOCK.TERMINATOR,
	// Ignore free, since this is a sparse stream
	BLOCK.FREE,
];

export async function* sparseReadStream(image: Image) {
	for (const { entry, block } of blockGenerator(image, EXCLUDE)) {
		let position =
			entry.map.sectorNumber * SECTOR_SIZE + block.sectorNumber * SECTOR_SIZE;
		if (block.type === BLOCK.ZEROFILL) {
			const size = block.sectorCount * SECTOR_SIZE;
			for await (const buffer of new ZeroStream(size)) {
				yield { buffer, position };
				position += buffer.length;
			}
		} else {
			const offset = image.footer!.dataForkOffset + block.compressedOffset;
			const length = block.compressedLength;
			const inputStream = await image.fs.createReadStream(
				offset,
				offset + length - 1,
			);
			const stream = blockDecompressor(block.type, inputStream);
			for await (const buffer of stream) {
				yield { buffer, position };
				position += buffer.length;
			}
		}
	}
}
