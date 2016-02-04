'use strict';

/**
 * The `kss/generator` module loads the {@link KssGenerator} class.
 * ```
 * const KssGenerator = require('kss/generator');
 * ```
 * @module kss/generator
 */

/* **************************************************************
   See kss_example_generator.js for how to implement a generator.
   ************************************************************** */

const Promise = require('bluebird');

const fs = Promise.promisifyAll(require('fs-extra'));

/**
 * A kss-node generator takes input files and generates a style guide.
 */
class KssGenerator {

  /**
   * Create a KssGenerator object.
   *
   * This is the base object used by all kss-node generators. Implementations of
   * KssGenerator MUST pass the version parameter. kss-node will use this to
   * ensure that only compatible generators are used.
   *
   * ```
   * const KssGenerator = require('kss/generator');
   * const customGenerator = new KssGenerator('3.0');
   * ```
   *
   * @param {string} version The generator API version implemented.
   * @param {object} options The Yargs-like options this generator has.
   *   See https://github.com/bcoe/yargs/blob/master/README.md#optionskey-opt
   */
  constructor(version, options) {
    // Tell generators which generator API version is currently running.
    this.API = '3.0';

    // Store the version of the generator API that the generator instance is
    // expecting; we will verify this in checkGenerator().
    this.implementsAPI = typeof version === 'undefined' ? 'undefined' : version;

    // Tell kss-node which Yargs-like options this generator has.
    this.options = options || {};

    // The log function defaults to console.log.
    this.setLogFunction(console.log);
  }

  /* eslint-disable no-unused-vars */
  /**
   * Logs a message to be reported to the user.
   *
   * Since a generator can be used in places other than the console, using
   * console.log() is inappropriate. The log() method should be used to pass
   * messages to the KSS system so it can report them to the user.
   *
   * @param {...string} message The message to log.
   */
  log(message) {
    /* eslint-enable no-unused-vars */
    this.logFunction.apply(null, arguments);
  }

  /**
   * The log() method logs a message for the user. This method allows the system
   * to define the underlying function used by the log method to report the
   * message to the user. The default log function is a wrapper around
   * `console.log()`.
   *
   * @param {Function} logFunction Function to log a message to the user.
   */
  setLogFunction(logFunction) {
    this.logFunction = logFunction;
  }

  /**
   * Checks the generator configuration.
   *
   * An instance of KssGenerator MUST NOT override this method. A process
   * controlling the generator should call this method to verify the
   * specified generator has been configured correctly.
   *
   * @returns {Promise} A `Promise` object resolving to `null`.
   */
  checkGenerator() {
    let isCompatible = true,
      version,
      apiMajor,
      apiMinor,
      thisMajor,
      thisMinor;

    if (!(this instanceof KssGenerator)) {
      return Promise.reject(new Error('The loaded generator is not a KssGenerator object.'));
    }

    if (this.implementsAPI === 'undefined') {
      isCompatible = false;
    } else {
      version = this.API.split('.');
      apiMajor = parseInt(version[0]);
      apiMinor = parseInt(version[1]);

      version = this.implementsAPI.split('.');
      thisMajor = parseInt(version[0]);
      thisMinor = parseInt(version[1]);

      if (thisMajor !== apiMajor || thisMinor > apiMinor) {
        isCompatible = false;
      }
    }

    if (!isCompatible) {
      return Promise.reject(new Error('kss-node expected the template\'s generator to implement KssGenerator API version ' + this.API + '; version "' + this.implementsAPI + '" is being used instead.'));
    }

    return Promise.resolve();
  }

  /**
   * Clone a template's files.
   *
   * This method is fairly simple; it copies one directory to the specified
   * location. An instance of KssGenerator does not need to override this method,
   * but it can if it needs to do something more complicated.
   *
   * @param {string} templatePath    Path to the template to clone.
   * @param {string} destinationPath Path to the destination of the newly cloned
   *                                 template.
   * @returns {Promise} A `Promise` object resolving to `null`.
   */
  clone(templatePath, destinationPath) {
    return fs.statAsync(destinationPath).catch(error => {
      // Pass the error on to the next .then().
      return error;
    }).then(result => {
      // If we successfully get stats, the destination exists.
      if (!(result instanceof Error)) {
        return Promise.reject(new Error('This folder already exists: ' + destinationPath));
      }

      // If the destination path does not exist, we copy the template to it.
      if (result.code === 'ENOENT') {
        return fs.copyAsync(
          templatePath,
          destinationPath,
          {
            clobber: true,
            filter: /^[^.]/
          }
        );
      }

      // Otherwise, report the error.
      return Promise.reject(result);
    });
  }

  /**
   * Initialize the style guide creation process.
   *
   * This method is given a configuration JSON object with the details of the
   * requested style guide generation. The generator can use this information for
   * any necessary tasks before the KSS parsing of the source files.
   *
   * @param {Object} config Configuration object for the requested generation.
   * @returns {Promise} A `Promise` object resolving to `null`.
   */
  init(config) {
    // At the very least, generators MUST save the configuration parameters.
    this.config = config;

    return Promise.resolve();
  }

  /**
   * Allow the template to prepare itself or modify the KssStyleGuide object.
   *
   * @param {KssStyleGuide} styleGuide The KSS style guide in object format.
   * @returns {Promise} A `Promise` object resolving to `styleGuide`.
   */
  prepare(styleGuide) {
    return Promise.resolve(styleGuide);
  }

  /**
   * Generate the HTML files of the style guide given a KssStyleGuide object.
   *
   * @param {KssStyleGuide} styleGuide The KSS style guide in object format.
   * @returns {Promise} A `Promise` object resolving to `styleGuide`.
   */
  generate(styleGuide) {
    return Promise.resolve(styleGuide);
  }
}

module.exports = KssGenerator;
