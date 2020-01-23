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
        if (!options) return Promise.reject('google cloud storage is not configured');
        var targetDir = this.getTargetDir(),
            googleStoragePath = `http${this.insecure?'':'s'}://${this.assetDomain}`;
        var targetFilenameOut=null;

        return new Promise((resolve, reject) => {
            this.getUniqueFileName(image, targetDir).then(targetFilename => {
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
        const googleStoragePath = `http${this.insecure?'':'s'}://${this.assetDomain}`;
        if(typeof filename.path !== 'undefined') {
            filename=filename.path;
        }
        if(filename.indexOf(googleStoragePath) !== -1){
            filename=filename.replace(googleStoragePath, '');
        }
        var rs = this.bucket.file(filename);
        return new Promise(function (resolve, reject) {
            rs.download()
                .then(function(data){
                    resolve(data[0]);
                })
                .catch(reject)
        });
    }

    delete (filename) {
        return this.bucket.file(filename).delete();
    }
}

module.exports = GStore;
