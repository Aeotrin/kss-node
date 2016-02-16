// Remove after https://github.com/Constellation/doctrine/issues/100 is fixed.
/* eslint-disable valid-jsdoc */

'use strict';

/**
 * The `kss/generator/handlebars` module loads the kssHandlebarsGenerator
 * object, a `{@link KssGenerator}` object using Handlebars templating.
 * ```
 * const kssHandlebarsGenerator = require('kss/generator/handlebars');
 * ```
 * @module kss/generator/handlebars
 */

const KssGenerator = require('../kss_generator.js'),
  marked = require('marked'),
  path = require('path'),
  Promise = require('bluebird');

const fs = Promise.promisifyAll(require('fs-extra')),
  glob = Promise.promisify(require('glob'));

// Pass a string to KssGenerator() to tell the system which API version is
// implemented by kssHandlebarsGenerator.
let kssHandlebarsGenerator = new KssGenerator('3.0', {
  'helpers': {
    group: 'Style guide:',
    string: true,
    path: true,
    describe: 'Location of custom handlebars helpers; see http://bit.ly/kss-wiki'
  },
  'homepage': {
    group: 'Style guide:',
    string: true,
    multiple: false,
    describe: 'File name of the homepage\'s Markdown file',
    default: 'homepage.md'
  },
  'placeholder': {
    group: 'Style guide:',
    string: true,
    multiple: false,
    describe: 'Placeholder text to use for modifier classes',
    default: '[modifier class]'
  },
  'nav-depth': {
    group: 'Style guide:',
    multiple: false,
    describe: 'Limit the navigation to the depth specified',
    default: 3
  }
});

/**
 * Initialize the style guide creation process.
 *
 * This method is given a configuration JSON object with the details of the
 * requested style guide generation. The generator can use this information for
 * any necessary tasks before the KSS parsing of the source files.
 *
 * @alias module:kss/generator/handlebars.init
 * @param {Object} config Configuration object for the requested generation.
 * @returns {Promise} A `Promise` object.
 */
kssHandlebarsGenerator.init = function(config) {
  // Save the configuration parameters.
  this.config = config;
  this.config.helpers = this.config.helpers || [];

  // Store the global Handlebars object.
  this.Handlebars = require('handlebars');

  // Load the standard Handlebars helpers.
  require('./helpers.js').register(this.Handlebars, this.config);

  if (this.config.verbose) {
    this.log('');
    this.log('Generating your KSS style guide!');
    this.log('');
    this.log(' * KSS Source  : ' + this.config.source.join(', '));
    this.log(' * Destination : ' + this.config.destination);
    this.log(' * Template    : ' + this.config.template);
    if (this.config.helpers.length) {
      this.log(' * Helpers     : ' + this.config.helpers.join(', '));
    }
    this.log('');
  }

  let initTasks = [];

  // Create a new destination directory.
  initTasks.push(
    fs.mkdirsAsync(this.config.destination).then(() => {
      // Optionally, copy the contents of the template's "kss-assets" folder.
      return fs.copyAsync(
        this.config.template + '/kss-assets',
        this.config.destination + '/kss-assets',
        {
          clobber: true,
          filter: /^[^.]/
        }
      ).catch(() => {
        // If the template does not have a kss-assets folder, ignore the error.
        return Promise.resolve();
      });
    })
  );

  // Load Handlebars helpers.
  this.config.helpers.forEach(directory => {
    initTasks.push(
      fs.readdirAsync(directory).then(helperFiles => {
        helperFiles.forEach(fileName => {
          if (path.extname(fileName) === '.js') {
            let helper = require(path.join(directory, fileName));
            if (typeof helper.register === 'function') {
              helper.register(this.Handlebars, this.config);
            }
          }
        });
      })
    );
  });

  return Promise.all(initTasks).then(() => {
    // Compile the Handlebars template.
    return fs.readFileAsync(this.config.template + '/index.html', 'utf8').then(content => {
      this.template = this.Handlebars.compile(content);
      return Promise.resolve();
    });
  });
};

/**
 * Generate the HTML files of the style guide given a KssStyleGuide object.
 *
 * @alias module:kss/generator/handlebars.generate
 * @param {KssStyleGuide} styleGuide The KSS style guide in object format.
 * @returns {Promise} A `Promise` object.
 */
kssHandlebarsGenerator.generate = function(styleGuide) {
  this.styleGuide = styleGuide;
  this.partials = {};

  let sections = this.styleGuide.sections();

  if (this.config.verbose && this.styleGuide.meta.files) {
    this.log(this.styleGuide.meta.files.map(file => {
      return ' - ' + file;
    }).join('\n'));
  }

  // Return an error if no KSS sections are found in the source files.
  if (sections.length === 0) {
    return Promise.reject(new Error('No KSS documentation discovered in source files.'));
  }

  if (this.config.verbose) {
    this.log('...Determining section markup:');
  }

  let sectionRoots = [];
  return Promise.all(
    sections.map(section => {
      // Accumulate an array of section references for all sections at the root
      // of the style guide.
      let currentRoot = section.reference().split(/(?:\.|\ \-\ )/)[0];
      if (sectionRoots.indexOf(currentRoot) === -1) {
        sectionRoots.push(currentRoot);
      }

      if (!section.markup()) {
        return Promise.resolve();
      }

      // Register all the markup blocks as Handlebars partials.
      let findPartial,
        partial = {
          name: section.reference(),
          reference: section.reference(),
          file: '',
          markup: section.markup(),
          data: {}
        };
      // If the markup is a file path, attempt to load the file.
      if (partial.markup.match(/^[^\n]+\.(html|hbs)$/)) {
        partial.file = partial.markup;
        partial.name = path.basename(partial.file, path.extname(partial.file));

        findPartial = Promise.all(
          this.config.source.map(source => {
            return glob(source + '/**/' + partial.file);
          })
        ).then(globMatches => {
          for (let files of globMatches) {
            if (files.length) {
              // Read the file contents from the first matched path.
              partial.file = files[0];
              return fs.readFileAsync(partial.file, 'utf8');
            }
          }

          // If the markup file is not found, note that in the style guide.
          partial.markup += ' NOT FOUND!';
          if (!this.config.verbose) {
            this.log('WARNING: In section ' + partial.reference + ', ' + partial.markup);
          }
          return '';
        }).then(contents => {
          if (this.config.verbose) {
            this.log(' - ' + partial.reference + ': ' + partial.markup);
          }
          if (contents) {
            partial.markup = contents;
            // Load sample data for the partial from the sample .json file.
            try {
              partial.data = require(path.join(path.dirname(partial.file), partial.name + '.json'));
            } catch (error) {
              partial.data = {};
            }
          }
          return partial;
        });
      } else {
        if (this.config.verbose) {
          this.log(' - ' + partial.reference + ': inline markup');
        }
        findPartial = Promise.resolve(partial);
      }

      return findPartial.then(partial => {
        // Register the partial using the file name (without extension) or using
        // the style guide reference.
        this.Handlebars.registerPartial(partial.name, partial.markup);
        // Save the name of the partial and its data for retrieval in the markup
        // helper, where we only know the reference.
        this.partials[partial.reference] = {
          name: partial.name,
          data: partial.data
        };

        return Promise.resolve();
      });
    })
  ).then(() => {
    // If a root element doesn't have an actual section, build one for it.
    // @TODO: Move this "fixing" into KssStyleGuide.
    let rootCount = sectionRoots.length;
    let newSection = false;
    for (let i = 0; i < rootCount; i += 1) {
      let currentRoot = this.styleGuide.sections(sectionRoots[i]);
      if (currentRoot === false) {
        // Add a section to the style guide.
        newSection = true;
        this.styleGuide
          .autoInit(false)
          .sections({
            header: sectionRoots[i],
            reference: sectionRoots[i]
          });
      }
    }
    // Re-init the style guide if we added new sections.
    if (newSection) {
      this.styleGuide.autoInit(true);
    }

    if (this.config.verbose) {
      this.log('...Generating style guide pages:');
    }

    // Group all of the sections by their root reference, and make a page for
    // each.
    let pagePromises = sectionRoots.map(rootReference => {
      return this.generatePage(rootReference, this.styleGuide.sections(rootReference + '.*'));
    });

    // Generate the homepage.
    pagePromises.push(this.generatePage('styleGuide.homepage', []));

    return Promise.all(pagePromises);
  });
};

/**
 * Creates a 2-level hierarchal menu from the style guide.
 *
 * @param {string} pageReference The reference of the root section of the page
 *   being generated.
 * @returns {Array} An array of menu items that can be used as a Handlebars
 *   variable.
 */
kssHandlebarsGenerator.createMenu = function(pageReference) {
  // Helper function that converts a section to a menu item.
  const toMenuItem = function(section) {
    // @TODO: Add an option to "include" the specific properties returned.
    let menuItem = section.toJSON();

    // Remove data we definitely won't need for the menu.
    delete menuItem.markup;
    delete menuItem.modifiers;
    delete menuItem.parameters;

    // Mark the current page in the menu.
    menuItem.isActive = (menuItem.reference === pageReference);

    // Mark any "deep" menu items.
    menuItem.isGrandChild = (menuItem.depth > 2);

    return menuItem;
  };

  // Retrieve all the root sections of the style guide.
  return this.styleGuide.sections('x').map(rootSection => {
    let menuItem = toMenuItem(rootSection);

    // Retrieve the child sections for each of the root sections.
    menuItem.children = this.styleGuide.sections(rootSection.reference() + '.*').slice(1).map(toMenuItem);

    // Remove menu items that are deeper than the nav-depth config setting.
    for (let i = 0; i < menuItem.children.length; i++) {
      if (menuItem.children[i].depth > this.config['nav-depth']) {
        delete menuItem.children[i];
      }
    }

    return menuItem;
  });
};

/**
 * Renders the handlebars template for a section and saves it to a file.
 *
 * @alias module:kss/generator/handlebars.generatePage
 * @param {string} pageReference The reference of the current page's root
 *   section.
 * @param {Array} sections An array of KssSection objects.
 * @returns {Promise} A `Promise` object.
 */
kssHandlebarsGenerator.generatePage = function(pageReference, sections) {
  let getFileInfo;

  // Create a Promise resulting in the homepage file information.
  if (pageReference === 'styleGuide.homepage') {
    let fileInfo = {
      fileName: 'index.html',
      homePageText: false
    };
    if (this.config.verbose) {
      this.log(' - homepage');
    }

    getFileInfo = Promise.all(
      this.config.source.map(source => {
        return glob(source + '/**/' + this.config.homepage);
      })
    ).then(globMatches => {
      for (let files of globMatches) {
        if (files.length) {
          // Read the file contents from the first matched path.
          return fs.readFileAsync(files[0], 'utf8');
        }
      }

      if (this.config.verbose) {
        this.log('   ...no homepage content found in ' + this.config.homepage + '.');
      } else {
        this.log('WARNING: no homepage content found in ' + this.config.homepage + '.');
      }
      return '';
    }).then(homePageText => {
      // Ensure homePageText is a non-false value.
      fileInfo.homePageText = homePageText ? marked(homePageText) : ' ';
      return fileInfo;
    });

  // Create a Promise resulting in the non-homepage file information.
  } else {
    let rootSection = this.styleGuide.sections(pageReference),
      fileInfo = {
        fileName: 'section-' + rootSection.referenceURI() + '.html',
        homePageText: false
      };
    if (this.config.verbose) {
      this.log(
        ' - section ' + pageReference + ' [',
        rootSection.header() ? rootSection.header() : 'Unnamed',
        ']'
      );
    }
    getFileInfo = Promise.resolve(fileInfo);
  }

  return getFileInfo.then(fileInfo => {
    // Create the HTML to load the optional CSS and JS.
    let styles = '',
      scripts = '';
    for (let key in this.config.css) {
      if (this.config.css.hasOwnProperty(key)) {
        styles = styles + '<link rel="stylesheet" href="' + this.config.css[key] + '">\n';
      }
    }
    for (let key in this.config.js) {
      if (this.config.js.hasOwnProperty(key)) {
        scripts = scripts + '<script src="' + this.config.js[key] + '"></script>\n';
      }
    }

    return fs.writeFileAsync(path.join(this.config.destination, fileInfo.fileName),
      this.template({
        pageReference: pageReference,
        sections: sections.map(section => {
          return section.toJSON();
        }),
        menu: this.createMenu(pageReference),
        homepage: fileInfo.homePageText,
        styles: styles,
        scripts: scripts,
        hasNumericReferences: this.styleGuide.hasNumericReferences(),
        partials: this.partials,
        styleGuide: this.styleGuide,
        options: this.config || {}
      })
    );
  });
};

module.exports = kssHandlebarsGenerator;
