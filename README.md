# Apple Universal Disk Image Format (UDIF/DMG)

## Install via [npm](https://npmjs.com)

```sh
$ npm install --save @balena/udif
```

## Used by

- **[Etcher](https://github.com/balena-io/etcher)** to support Apple's disk image format (.dmg)

## Usage

```typescript
import * as UDIF from '@balena/udif';
```

### Opening a .dmg image

```typescript
await UDIF.withOpenImage('path/to/image.dmg', async (image) => {
	// ...
});
```

### Determining the uncompressed size

Note that the image has to be opened to determine the uncompressed size,
as this is read from the resource fork.

```typescript
return await UDIF.withOpenImage('path/to/image.dmg', async (image) => {
	return await image.getUncompressedSize();
});
```

### Creating a readable stream

```typescript
await UDIF.withOpenImage('path/to/image.dmg', async (image) => {
	const readableStream = await image.createReadStream();
});
```

### Extracting the raw disk image

Extracting the uncompressed, raw disk image from a `.dmg` file becomes as easy as the following:

```typescript
import * as UDIF from '@balena/udif';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

await UDIF.withOpenImage('path/to/image.dmg', async (image) => {
	await pipelineAsync(
		await image.createReadStream(),
		fs.createWriteStream('/path/to/destination.img'),
	);
});
```

### Sparse streams

```typescript
await UDIF.withOpenImage('path/to/image.dmg', async (image) => {
	const sparseStream = await image.createSparseReadStream();
});
```

Sparse readstreams are in `objectMode` and will emit objects of the shape `{ buffer, position }`.
This means you'll need a writable stream that is also in `objectMode` and knows how to handle these.
For the sake of brevity, the following example only demonstrates passing a chunk's properties to `fs.write()`;

```typescript
sparseStream.on('data', (chunk) => {
	fs.writeSync(fd, chunk.buffer, 0, chunk.buffer.length, chunk.position);
})
```

### Using a custom file system

```typescript
import * as UDIF from '@balena/udif';
import * as fs from 'fs';

const fd = fs.openSync('path/to/image.dmg', 'r');
const size = fs.fstatSync(fd).size;

const dmg = new UDIF.Image({
	size,
	createReadStream: async (start: number, end: number) => {
		return fs.createReadStream('', { fd, start, end, autoClose: false });
	},
})
await dmg.ready;

// ...

fs.closeSync(fd);
```

### Inspecting the UDIF footer

The footer (aka the "Koly Block") contains pointers to the XML metadata,
data fork & resource fork as well as checksums.

```typescript
await UDIF.withOpenImage('path/to/image.dmg', async (image) => {
	console.log(image.footer)
});
```

```typescript
KolyBlock {
  signature: 1802464377,
  version: 4,
  headerSize: 512,
  flags: 1,
  runningDataForkOffset: 0,
  dataForkOffset: 0,
  dataForkLength: 6585140266,
  resourceForkOffset: 0,
  resourceForkLength: 0,
  segmentNumber: 1,
  segmentCount: 1,
  segmentId: <Buffer 18 66 9e 31 fa 6 d 4 f 7 d aa d0 f2 50 12 8 f 49 54>,
  dataChecksum: Checksum { type: 2, bits: 32, value: 'c2208200' },
  xmlOffset: 6585140266,
  xmlLength: 1752206,
  reserved1: <Buffer 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ...>,
  checksum: Checksum { type: 2, bits: 32, value: '3f40bb47' },
  imageVariant: 1,
  sectorCount: 15178432,
  reserved2: 0,
  reserved3: 0,
  reserved4: 0,
}
```

### Inspecting the XML Metadata

The XML data is a [Property List](https://en.wikipedia.org/wiki/Property_list), (or plist) which contains a block map under `resource-fork.blkx`.

```typescript
await UDIF.withOpenImage('path/to/image.dmg', async (image) => {
	console.log(image.resourceFork)
});
```

```typescript
{
  blkx: [{
    id: -1,
    attributes: 80,
    name: 'Driver Descriptor Map (DDM : 0)',
    coreFoundationName: 'Driver Descriptor Map (DDM : 0)',
    map: BlockMap {
      signature: 1835627368,
      version: 1,
      sectorNumber: 0,
      sectorCount: 1,
      dataOffset: 0,
      buffersNeeded: 520,
      blockDescriptorCount: 0,
      reserved1: 0,
      reserved2: 0,
      reserved3: 0,
      reserved4: 0,
      reserved5: 0,
      reserved6: 0,
      checksum: Checksum { type: 2, bits: 32, value: '698a85ed' },
      blockCount: 2,
      blocks: [
        Block {
          type: 2147483653,
          description: 'UDZO (zlib-compressed)',
          comment: '',
          sectorNumber: 0,
          sectorCount: 1,
          compressedOffset: 0,
          compressedLength: 22
        },
        Block {
          type: 4294967295,
          description: 'TERMINATOR',
          comment: '',
          sectorNumber: 1,
          sectorCount: 0,
          compressedOffset: 22,
          compressedLength: 0
        }
      ]
    }
  }, {
    id: 0,
    attributes: 80,
    name: 'WINDOWSSUPPORT (Apple_ISO : 1)',
    coreFoundationName: 'WINDOWSSUPPORT (Apple_ISO : 1)',
    map: BlockMap {
      signature: 1835627368,
      version: 1,
      sectorNumber: 1,
      sectorCount: 3,
      dataOffset: 0,
      buffersNeeded: 520,
      blockDescriptorCount: 1,
      reserved1: 0,
      reserved2: 0,
      reserved3: 0,
      reserved4: 0,
      reserved5: 0,
      reserved6: 0,
      checksum: Checksum { type: 2, bits: 32, value: '6c1ce17e' },
      blockCount: 2,
      blocks: [
        Block {
          type: 2147483653,
          description: 'UDZO (zlib-compressed)',
          comment: '',
          sectorNumber: 0,
          sectorCount: 3,
          compressedOffset: 22,
          compressedLength: 24
        },
        Block {
          type: 4294967295,
          description: 'TERMINATOR',
          comment: '',
          sectorNumber: 3,
          sectorCount: 0,
          compressedOffset: 46,
          compressedLength: 0
        }
      ]
    }
  }, {
    id: 1,
    attributes: 80,
    name: 'Apple (Apple_partition_map : 2)',
    coreFoundationName: 'Apple (Apple_partition_map : 2)',
    map: BlockMap {
      signature: 1835627368,
      version: 1,
      sectorNumber: 4,
      sectorCount: 60,
      dataOffset: 0,
      buffersNeeded: 520,
      blockDescriptorCount: 2,
      reserved1: 0,
      reserved2: 0,
      reserved3: 0,
      reserved4: 0,
      reserved5: 0,
      reserved6: 0,
      checksum: Checksum { type: 2, bits: 32, value: '115fc68e' },
      blockCount: 2,
      blocks: [
        Block {
          type: 2147483653,
          description: 'UDZO (zlib-compressed)',
          comment: '',
          sectorNumber: 0,
          sectorCount: 60,
          compressedOffset: 46,
          compressedLength: 358
        },
        Block {
          type: 4294967295,
          description: 'TERMINATOR',
          comment: '',
          sectorNumber: 60,
          sectorCount: 0,
          compressedOffset: 404,
          compressedLength: 0
        }
      ]
    }
  }, {
    id: 2,
    attributes: 80,
    name: 'Macintosh (Apple_Driver_ATAPI : 3)',
    coreFoundationName: 'Macintosh (Apple_Driver_ATAPI : 3)',
    map: BlockMap {
      signature: 1835627368,
      version: 1,
      sectorNumber: 64,
      sectorCount: 2020420,
      dataOffset: 0,
      buffersNeeded: 520,
      blockDescriptorCount: 3,
      reserved1: 0,
      reserved2: 0,
      reserved3: 0,
      reserved4: 0,
      reserved5: 0,
      reserved6: 0,
      checksum: Checksum { type: 2, bits: 32, value: 'b2bb86f8' },
      blockCount: 3948,
      blocks: [
        Block {
          type: 2147483653,
          description: 'UDZO (zlib-compressed)',
          comment: '',
          sectorNumber: 0,
          sectorCount: 512,
          compressedOffset: 404,
          compressedLength: 25147
        },
        Block {
          type: 2147483653,
          description: 'UDZO (zlib-compressed)',
          comment: '',
          sectorNumber: 512,
          sectorCount: 512,
          compressedOffset: 25551,
          compressedLength: 29149
        },
        ... more items
      ]
    }
  }, {
    id: 3,
    attributes: 80,
    name: ' (Apple_Free : 4)',
    coreFoundationName: ' (Apple_Free : 4)',
    map: BlockMap {
      signature: 1835627368,
      version: 1,
      sectorNumber: 2020484,
      sectorCount: 4,
      dataOffset: 0,
      buffersNeeded: 0,
      blockDescriptorCount: 4,
      reserved1: 0,
      reserved2: 0,
      reserved3: 0,
      reserved4: 0,
      reserved5: 0,
      reserved6: 0,
      checksum: Checksum { type: 2, bits: 32, value: '00000000' },
      blockCount: 2,
      blocks: [
        Block {
          type: 2,
          description: 'FREE (unallocated)',
          comment: '',
          sectorNumber: 0,
          sectorCount: 4,
          compressedOffset: 984141554,
          compressedLength: 0
        },
        Block {
          type: 4294967295,
          description: 'TERMINATOR',
          comment: '',
          sectorNumber: 4,
          sectorCount: 0,
          compressedOffset: 984141554,
          compressedLength: 0
        }
      ]
    }
  }, {
    id: 4,
    attributes: 80,
    name: 'Mac_OS_X (Apple_HFS : 5)',
    coreFoundationName: 'Mac_OS_X (Apple_HFS : 5)',
    map: BlockMap {
      signature: 1835627368,
      version: 1,
      sectorNumber: 2020488,
      sectorCount: 13157944,
      dataOffset: 0,
      buffersNeeded: 520,
      blockDescriptorCount: 5,
      reserved1: 0,
      reserved2: 0,
      reserved3: 0,
      reserved4: 0,
      reserved5: 0,
      reserved6: 0,
      checksum: Checksum { type: 2, bits: 32, value: '39ce04b6' },
      blockCount: 25387,
      blocks: [
        Block {
          type: 2147483646,
          description: 'COMMENT',
          comment: '+beg',
          sectorNumber: 0,
          sectorCount: 0,
          compressedOffset: 984141554,
          compressedLength: 0
        },
        Block {
          type: 2147483653,
          description: 'UDZO (zlib-compressed)',
          comment: '',
          sectorNumber: 0,
          sectorCount: 512,
          compressedOffset: 984141554,
          compressedLength: 1812
        },
        ... more items
      ]
    }
  }],
  cSum: [{
    Attributes: '0x0000',
    Data: <Buffer 01 00 02 00 00 00 00 00 00 00>,
    ID: '0',
    Name: null
  }, {
    Attributes: '0x0000',
    Data: <Buffer 01 00 02 00 00 00 10 fc a8 3f>,
    ID: '1',
    Name: null
  }, {
    Attributes: '0x0000',
    Data: <Buffer 01 00 02 00 00 00 10 37 71 ef>,
    ID: '2',
    Name: null
  }],
  nsiz: [{
    Attributes: '0x0000',
    Data: <Buffer 3 c 3 f 78 6 d 6 c 20 76 65 72 73 69 6 f 6e 3 d 22 31 2e 30 22 20 65 6e 63 6 f 64 69 6e 67 3 d 22 55 54 46 2 d 38 22 3 f 3e 0 a 3 c 21 44 4 f 43 54 59 50 45 20 70 ...>,
    ID: '0',
    Name: null
  }, {
    Attributes: '0x0000',
    Data: <Buffer 3 c 3 f 78 6 d 6 c 20 76 65 72 73 69 6 f 6e 3 d 22 31 2e 30 22 20 65 6e 63 6 f 64 69 6e 67 3 d 22 55 54 46 2 d 38 22 3 f 3e 0 a 3 c 21 44 4 f 43 54 59 50 45 20 70 ...>,
    ID: '1',
    Name: null
  }, {
    Attributes: '0x0000',
    Data: <Buffer 3 c 3 f 78 6 d 6 c 20 76 65 72 73 69 6 f 6e 3 d 22 31 2e 30 22 20 65 6e 63 6 f 64 69 6e 67 3 d 22 55 54 46 2 d 38 22 3 f 3e 0 a 3 c 21 44 4 f 43 54 59 50 45 20 70 ...>,
    ID: '2',
    Name: null
  }],
  plst: [{
    Attributes: '0x0050',
    Data: <Buffer 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ...>,
    ID: '0',
    Name: null
  }],
  size: [{
    Attributes: '0x0000',
    Data: <Buffer 05 00 01 00 00 00 00 60 8 c 91 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ...>,
    ID: '2',
    Name: null
  }]
}

```

## References

- [Demystifying the DMG File Format](http://newosxbook.com/DMG.html)
- [VBox/Storage/DMG.cpp](https://www.virtualbox.org/svn/vbox/trunk/src/VBox/Storage/DMG.cpp)
- [man1/hdiutil.1](https://www.unix.com/man-page/osx/1/hdiutil/)
- [Wikipedia/Apple_Disk_Image](https://en.wikipedia.org/wiki/Apple_Disk_Image)
