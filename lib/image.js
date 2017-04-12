var fs = require( 'fs' )
var plist = require( 'plist' )
var UDIF = require( './udif' )

/**
 * Apple Disk Image (DMG)
 * @constructor
 * @return {Image}
 */
function Image( path ) {

  if( !(this instanceof Image) )
    return new Image( path )

  this.path = path
  this.fd = null
  this.footer = null
  this.resources = []

}

Image.parseResourceMap = function( resourceFork ) {

  var blocks = resourceFork['blkx']
  var block = null

  // NOTE: What to do with `resourceFork['plst']`!?

  var resources = []

  for( var i = 0; i < blocks.length; i++ ) {
    block = blocks[i]
    resources.push({
      id: +block['ID'],
      attributes: +block['Attributes'],
      name: block['Name'],
      coreFoundationName: block['CFName'],
      map: UDIF.BlockMap.parse( block['Data'] )
    })
  }

  return resources

}

/**
 * Image prototype
 * @type {Object}
 * @ignore
 */
Image.prototype = {

  constructor: Image,

  /**
   * Create a readable stream of this image
   * @param {Object} [options]
   * @returns {UDIF.ReadStream}
   */
  createReadStream( options ) {
    return new UDIF.ReadStream( this.path, options )
  },

  /**
   * Calculate the uncompressed size of the contained resource
   * @return {Number} size in bytes
   */
  getUncompressedSize() {
    return this.resources.reduce(( size, resource ) => {
      return resource.map.blocks.reduce(( size, block ) => {
        return size + ( block.sectorCount * UDIF.SECTOR_SIZE )
      }, size )
    }, 0 )
  },

  readFooter: function( callback ) {

    var length = UDIF.Footer.size
    var buffer = Buffer.alloc( length, 0 )

    fs.fstat( this.fd, ( error, stats ) => {
      if( error ) return callback.call( this, error )
      var position = stats.size - UDIF.Footer.size
      fs.read( this.fd, buffer, 0, length, position, ( error, bytesRead, buffer ) => {
        if( error ) return callback.call( this, error )
        try { this.footer = UDIF.Footer.parse( buffer ) }
        catch( error ) { return callback.call( this, error ) }
        callback.call( this, null, this.footer )
      })
    })

  },

  readPropertyList: function( callback ) {

    if( this.footer == null ) {
      return callback.call( this, new Error( 'Must read footer before property list' ) )
    }

    var length = this.footer.xmlLength
    var position = this.footer.xmlOffset
    var buffer = new Buffer( length )

    fs.read( this.fd, buffer, 0, length, position, ( error, bytesRead, buffer ) => {
      if( error ) return callback.call( this, error )
      var data = plist.parse( buffer.toString() )
      try { this.resources = Image.parseResourceMap( data['resource-fork'] ) }
      catch( error ) { return callback.call( this, error ) }
      callback.call( this, null, this.resources )
    })

  },

  open: function( callback ) {

    if( this.fd != null ) {
      return callback.call( this, null, this.fd )
    }

    var tasks = [
      ( next ) => {
        fs.open( this.path, 'r', ( error, fd ) => {
          this.fd = fd
          next( error )
        })
      },
      ( next ) => this.readFooter( next ),
      ( next ) => this.readPropertyList( next ),
    ]

    var run = ( error ) => {
      if( error ) return callback.call( this, error )
      var task = tasks.shift()
      task ? task( run ) : callback.call( this )
    }

    run()

    return this

  },

  close: function( callback ) {

    if( this.fd == null ) {
      return callback.call( this )
    }

    var self = this

    fs.close( this.fd, function( error ) {
      callback.call( self, error )
    })

    return this

  },

}

// Exports
module.exports = Image