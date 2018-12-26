'use strict';

var storage     = require('@google-cloud/storage'),
    BaseStore   = require('ghost-storage-base'),
    Promise     = require('bluebird'),
    path        = require('path'),
    options     = {};

class GStore extends BaseStore {
    constructor(config = {}){
        super(config);
        options = config;

        var gcs = storage({
            projectId: options.projectId,
            keyFilename: options.key
        });
        this.bucket = gcs.bucket(options.bucket);
        this.assetDomain = options.assetDomain || `storage.googleapis.com/${options.bucket}/`;
        if(options.hasOwnProperty('assetDomain')){
            this.insecure = options.insecure;
        }
        // default max-age is 3600 for GCS, override to something more useful
        this.maxAge = options.maxAge || 2678400;
    }

    /**
     *
     * @param image  image is the express image object
     * @param targetDir
     * @returns {*}
     */
    save(image, targetDir) {
        console.log(image, 'image');
        console.log(targetDir, 'targetDir');
        if (!options) return Promise.reject('google cloud storage is not configured');
        console.log(image);
        console.log(this.getTargetDir(), 'DIR');
        var targetDir = this.getTargetDir(),
            googleStoragePath = `http${this.insecure?'':'s'}://${this.assetDomain}`;
        var targetFilenameOut=null;

        return new Promise((resolve, reject) => {
            this.getUniqueFileName(image, targetDir).then(targetFilename => {
                console.log(
                    targetFilename, 'TARGETFILENAME' );

                var fileNamePath=null;
                if(targetFilename.indexOf(targetDir) === -1) {
                    fileNamePath =targetDir + targetFilename;
                } else {
                    fileNamePath=targetFilename;
                }
                targetFilenameOut=fileNamePath;
                var opts = {
                    destination: fileNamePath,
                    metadata: {
                        cacheControl: `public, max-age=${this.maxAge}`
                    },
                    public: true
                };
                return this.bucket.upload(image.path, opts);
            }).then(function (data) {
                console.log(data);
                console.log(data[0].name);
                console.log('RESOVLE UPLOAD', targetFilenameOut);
                return resolve( googleStoragePath  + targetFilenameOut);
            }).catch(function (e) {
                return reject(e);
            });
        });
    }

    // middleware for serving the files
    serve() {
        // a no-op, these are absolute URLs
        return function (req, res, next) { next(); };
    }

    exists (filename, targetDir) {
        return this.bucket
            .file(path.join(targetDir, filename))
            .exists()
            .then(function(data){
                return data[0];
            })
            .catch(err => Promise.reject(err));
    }

    read (filename) {
        console.log(filename, 'WHAT DA HECK');
        //console.log(this.bucket);

        if(typeof filename.path !== 'undefined') {
            filename=filename.path;
        }
        const file = this.bucket.file(filename);

        try {
            var st=file.createReadStream()

            var rs = this.bucket.file(filename).createReadStream();//, contents = ''
            var contents='';
            return new Promise(function (resolve, reject) {
                rs.on('error', function(err){
                    console.log('error read file');
                    //console.log(err);
                    return reject(err);
                });
                rs.on('data', function(data){
                    contents += data;
                });
                rs.on('end', function(){
                    console.log('END');
                    //console.log(contents);
                    return resolve(contents);
                });
            });
        } catch(e){
            console.log('STREAM TO DEATH', e);
        }
    }

    delete (filename) {
        console.log('delete', filename);
        return this.bucket.file(filename).delete();
    }
}

module.exports = GStore;
