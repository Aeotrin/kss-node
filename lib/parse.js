'use strict';

/**
 * The `kss/lib/parse` module is normally accessed via the
 * [`parse()`]{@link module:kss.parse} method of the `kss` module:
 * ```
 * const kss = require('kss');
 * kss.parse(input, options, callback);
 * ```
 * @private
 * @module kss/lib/parse
 */

const KssStyleGuide = require('./kss_styleguide.js'),
  KssSection = require('./kss_section.js'),
  marked = require('marked'),
  natural = require('natural');

// Create a MarkDown renderer that does not output a wrapping paragraph.
const inlineRenderer = new marked.Renderer();
inlineRenderer.paragraph = function(text) {
  return text;
};

let parse, parseChunk, findBlocks,
  createModifiers, createParameters,
  checkReference, processProperty, hasPrefix;

/**
 * Parse an array/string of documented CSS, or an object of files
 * and their content.
 *
 * File object formatted as `{ "absolute filename": content, ... }`.
 *
 * This is called automatically as part of `traverse` but is publicly
 * accessible as well.
 *
 * @alias module:kss.parse
 * @param  {*}        input    The input to parse
 * @param  {Object}   options  Options to alter the output content. Same as the options in [`traverse()`]{@link module:kss.traverse}.
 * @param  {Function} callback Called when parsing is complete
 */
parse = function(input, options, callback) {
  // If supplied a string, just make it an Array.
  if (typeof input === 'string') {
    input = [input];
  }

  let styleGuide = {};

  // Otherwise assume the input supplied is a JSON object, as specified above.
  if (!Array.isArray(input)) {
    let files = input;
    input = [];
    styleGuide.files = [];
    for (let fileName in files) {
      // istanbul ignore else
      if (files.hasOwnProperty(fileName)) {
        input.push(files[fileName]);
        styleGuide.files.push(fileName);
      }
    }
    styleGuide.files.sort();
  }

  // Default parsing options
  if (typeof options.markdown === 'undefined') {
    options.markdown = true;
  }
  if (typeof options.header === 'undefined') {
    options.header = true;
  }
  options.typos = options.typos || false;
  options.custom = options.custom || [];

  // Actually parse the input (parseChunk is the key function here.)
  styleGuide.sections = [];
  for (let i = 0; i < input.length; i++) {
    styleGuide = parseChunk(styleGuide, input[i], options);
  }

  callback(null, new KssStyleGuide(styleGuide));
};

/**
 * Take a chunk of text and parse the comments. This is the primary parsing
 * function, and eventually returns a `data` variable to use to create a new
 * instance of `KssStyleGuide`.
 *
 * @private
 * @param  {Object} styleGuide    JSON object containing all of the style guide data.
 * @param  {String} input   Text to be parsed, i.e. a single CSS/LESS/etc. file's content.
 * @param  {Object} options The options passed on from `traverse` or `parse`
 * @returns {Object} The raw style guide data from the newly parsed text.
 */
parseChunk = function(styleGuide, input, options) {
  /* eslint-disable no-loop-func */

  // Retrieve an array of "comment block" strings, and then evaluate each one.
  let blocks = findBlocks(input);

  for (let i = 0; i < blocks.length; i++) {
    // Create a new, temporary section object with some default values.
    // "raw" is a comment block from the array above.
    let currSection = {
      raw: blocks[i],
      header: '',
      description: '',
      modifiers: [],
      parameters: [],
      markup: false
    };

    // Split the comment block into paragraphs.
    let paragraphs = currSection.raw
      .replace(/\r\n/g, '\n')      // Convert Windows CRLF linebreaks.
      .replace(/\r/g, '\n')        // Convert Classic Mac CR linebreaks too.
      .replace(/\n\s+\n/g, '\n\n') // Trim whitespace-only lines.
      .replace(/^\s+|\s+$/g, '')   // Trim the string of white space.
      .split('\n\n');

    // Before anything else, process the properties that are clearly labeled and
    // can be found right away and then removed.
    currSection = processProperty('Markup', paragraphs, options, currSection);
    currSection = processProperty('Weight', paragraphs, options, currSection, function(value) {
      return isNaN(value) ? 0 : parseFloat(value);
    });
    // Process custom properties.
    options.custom.forEach(name => {
      currSection = processProperty(name, paragraphs, options, currSection);
    });

    // Ignore this block if a style guide reference number is not listed.
    currSection.reference = checkReference(paragraphs, options) || '';
    if (!currSection.reference) {
      continue;
    }

    // If the block is 1 paragraph long, copy the reference into the header.
    if (paragraphs.length === 1) {
      currSection.header = currSection.reference;
    // If the block is 2 paragraphs long, it is just a header and a reference.
    } else if (paragraphs.length === 2) {
      currSection.header = currSection.description = paragraphs[0];
    // If it's 3+ paragraphs long, search for modifiers.
    } else {

      // Extract the approximate header, description and modifiers paragraphs.
      // The modifiers will be split into an array of lines.
      currSection.header = paragraphs[0];
      currSection.description = paragraphs.slice(0, paragraphs.length - 2).join('\n\n');
      currSection.modifiers = paragraphs[paragraphs.length - 2].split('\n');

      // Check the modifiers paragraph. Does it look like it's a list of
      // modifiers, or just another paragraph of the description?
      let numModifierLines = currSection.modifiers.length,
        hasModifiers = true,
        lastModifier = 0;
      for (let j = 0; j < numModifierLines; j += 1) {
        if (currSection.modifiers[j].match(/^\s*.+?\s+\-\s/g)) {
          lastModifier = j;
        } else if (j === 0) {
          // The paragraph doesn't start with a modifier, so bail out.
          hasModifiers = false;
          j = numModifierLines;
        } else {
          // If the current line doesn't match a modifier, it must be a
          // multi-line modifier description.
          currSection.modifiers[lastModifier] += ' ' + currSection.modifiers[j].replace(/^\s+|\s+$/g, '');
          // We will strip this blank line later.
          currSection.modifiers[j] = '';
        }
      }
      // Remove any blank lines added.
      currSection.modifiers = currSection.modifiers.filter(line => { return line !== ''; });

      // If it's a modifiers paragraph, turn each one into a modifiers object.
      // Otherwise, add it back to the description.
      if (hasModifiers) {
        // If the current section has markup, create proper KssModifier objects.
        if (currSection.markup) {
          currSection.modifiers = createModifiers(currSection.modifiers, options);
        } else {
          // If the current section has no markup, create KssParameter objects.
          currSection.parameters = createParameters(currSection.modifiers, options);
          currSection.modifiers = [];
        }
      } else {
        currSection.description += '\n\n' + paragraphs[paragraphs.length - 2];
        currSection.modifiers = [];
      }
    }

    // Squash the header into a single line.
    currSection.header = currSection.header.replace(/\n/g, ' ');

    // Check the section's status.
    currSection.deprecated = hasPrefix(currSection.description, options, 'Deprecated');
    currSection.experimental = hasPrefix(currSection.description, options, 'Experimental');

    // If a separate header is requested, remove the first paragraph from the
    // description.
    if (options.header) {
      if (currSection.description.match(/\n{2,}/)) {
        currSection.description = currSection.description.replace(/^.*?\n{2,}/, '');
      } else {
        currSection.description = '';
      }
    }

    // Markdown Parsing.
    if (options.markdown) {
      currSection.description = marked(currSection.description);
    }

    // Add the new section instance to the sections array.
    currSection = new KssSection(currSection);
    styleGuide.sections.push(currSection);
  }
  /* eslint-enable no-loop-func */

  return styleGuide;
};

/**
 * Returns an array of comment blocks found within a string.
 *
 * @private
 * @param  {String} input   The string to search.
 * @returns {Array} The blocks found.
 */
findBlocks = function(input) {
  /* eslint-disable key-spacing */
  const commentExpressions = {
    single:        /^\s*\/\/.*$/,
    docblockStart: /^\s*\/\*\*\s*$/,
    multiStart:    /^\s*\/\*+\s*$/,
    multiFinish:   /^\s*\*\/\s*$/
  };
  /* eslint-enable key-spacing */

  input = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = input.split(/\n|$/g);

  let blocks = [],
    currentBlock = '',
    indentAmount = false,
    insideSingleBlock = false,
    insideMultiBlock = false,
    insideDocblock = false;
  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i];

    // Remove trailing space.
    line = line.replace(/\s*$/, '');

    // Single-line parsing.
    if (!insideMultiBlock && !insideDocblock && line.match(commentExpressions.single)) {
      if (insideSingleBlock && currentBlock !== '') {
        currentBlock += '\n';
      }
      currentBlock += line.replace(/^\s*\/\/\s?/, '');
      insideSingleBlock = true;
      continue;
    }

    // Since the current line is not a single line comment, save the current
    // block and continue parsing the current line.
    if (insideSingleBlock) {
      blocks.push(currentBlock.replace(/^\n+/, '').replace(/\n+$/, ''));
      insideSingleBlock = false;
      currentBlock = '';
    }

    // Save the current multi-/docblock if we have reached the end of the block.
    if ((insideMultiBlock || insideDocblock) && line.match(commentExpressions.multiFinish)) {
      blocks.push(currentBlock.replace(/^\n+/, '').replace(/\n+$/, ''));
      insideMultiBlock = insideDocblock = false;
      currentBlock = '';
      indentAmount = false;
      continue;
    }

    // Docblock parsing.
    if (line.match(commentExpressions.docblockStart)) {
      insideDocblock = true;
      currentBlock = '';
      continue;
    }
    if (insideDocblock) {
      currentBlock += '\n';
      currentBlock += line.replace(/^\s*\*\s?/, '');
      continue;
    }

    // Multi-line parsing.
    if (line.match(commentExpressions.multiStart)) {
      insideMultiBlock = true;
      currentBlock = '';
      continue;
    }
    if (insideMultiBlock) {
      // If this is the first interior line, determine the indentation amount.
      if (indentAmount === false) {
        // Skip initial blank lines.
        if (line === '') {
          continue;
        }
        indentAmount = line.match(/^\s*/)[0];
      }
      currentBlock += '\n';
      // Always strip same indentation amount from each line.
      currentBlock += line.replace(new RegExp('^' + indentAmount), '', 1);
    }
  }

  // Add the last comment block to our list of blocks.
  if (currentBlock) {
    blocks.push(currentBlock.replace(/^\n+/, '').replace(/\n+$/, ''));
  }

  return blocks;
};

/**
 * Takes an array of modifier lines, and turns it into a JSON equivalent of KssModifier.
 *
 * @private
 * @param  {Array}  lines   Modifier lines, which should all be strings.
 * @param  {Object} options Any options passed on by the functions above.
 * @returns {Array} The modifier instances created.
 */
createModifiers = function(lines, options) {
  return lines.map(entry => {
    // Split modifier name and the description.
    let modifier = entry.split(/\s+\-\s+/, 1)[0];
    let description = entry.replace(modifier, '', 1).replace(/^\s+\-\s+/, '');

    // Markdown parsing.
    if (options.markdown) {
      description = marked(description, {renderer: inlineRenderer});
    }

    return {
      name: modifier,
      description: description
    };
  });
};

/**
 * Takes an array of parameter lines, and turns it into instances of KssParameter.
 *
 * @private
 * @param  {Array}  lines   Parameter lines, which should all be strings.
 * @param  {Object} options Any options passed on by the functions above.
 * @returns {Array} The parameter instances created.
 */
createParameters = function(lines, options) {
  return lines.map(entry => {
    // Split parameter name and the description.
    let parameter = entry.split(/\s+\-\s+/, 1)[0];
    let description = entry.replace(parameter, '', 1).replace(/^\s+\-\s+/, '');

    // Markdown parsing.
    if (options.markdown) {
      description = marked(description, {renderer: inlineRenderer});
    }

    return {
      name: parameter,
      description: description
    };
  });
};

/**
 * Check a section for the reference number it may or may not have.
 *
 * @private
 * @param  {Array}  paragraphs An array of the paragraphs in a single block.
 * @param  {Object} options    The options object passed on from the initial functions
 * @returns {Boolean|String} False if not found, otherwise returns the reference number as a string.
 */
checkReference = function(paragraphs, options) {
  let lastParagraph = paragraphs[paragraphs.length - 1].trim(),
    words = lastParagraph.split(/\s+/);

  // If is only one word in the last paragraph, it can't be a style guide ref.
  if (words.length < 2) {
    return false;
  }

  // Search for the "styleguide" (or "style guide") keyword at the start of the paragraph.
  let keyword = false;
  [words[0], words[0] + words[1]].forEach((value, index) => {
    if (!keyword) {
      value = value.replace(/[-:]?$/, '');
      if (value.toLowerCase() === 'styleguide' || options.typos && natural.Metaphone.compare('Styleguide', value.replace('-', ''))) {
        keyword = words.shift();
        if (index === 1) {
          keyword += ' ' + words.shift();
        }
      }
    }
  });

  return keyword ? words.join(' ') : false;
};

/**
 * Checks if there is a specific property in the comment block and removes it from the original array.
 *
 * @private
 * @param  {String}   propertyName The name of the property to search for
 * @param  {Array}    paragraphs   An array of the paragraphs in a single block
 * @param  {Object}   options      The options object passed on from the initial functions
 * @param  {Object}   sectionData  The original data object of a section.
 * @param  {Function} processValue A function to massage the value before it is inserted into the sectionData.
 * @returns {Object} A new data object for the section.
 */
processProperty = function(propertyName, paragraphs, options, sectionData, processValue) {
  let indexToRemove = false;

  propertyName = propertyName.toLowerCase();

  paragraphs.map((paragraph, index) => {
    if (hasPrefix(paragraph, options, propertyName)) {
      sectionData[propertyName] = paragraph.replace(new RegExp('^\\s*' + propertyName + '\\:\\s+?', 'gmi'), '');
      if (typeof processValue === 'function') {
        sectionData[propertyName] = processValue(sectionData[propertyName]);
      }
      paragraph = '';
      indexToRemove = index;
    }
    return paragraph;
  });

  if (indexToRemove !== false) {
    paragraphs.splice(indexToRemove, 1);
  }

  return sectionData;
};

/**
 * Essentially this function checks if a string is prefixed by a particular attribute,
 * e.g. 'Deprecated:' and 'Markup:'
 *
 * If `options.typos` is enabled it'll try check if the first word at least sounds like
 * the word we're checking for.
 *
 * @private
 * @param  {String}  description The string to check
 * @param  {Object}  options     The options passed on from previous functions
 * @param  {String}  prefix      The prefix to search for
 * @returns {Boolean} Whether the description contains the specified prefix.
 */
hasPrefix = function(description, options, prefix) {
  if (!options.typos) {
    return (new RegExp('^\\s*' + prefix + '\\:', 'gmi')).test(description);
  }

  let words = description.replace(/^\s*/, '').match(/^\s*([a-z ]*):/gmi);
  if (!words) {
    return false;
  }

  return natural.Metaphone.compare(words[0].replace(':', ''), prefix);
};

module.exports = parse;
