'use strict';

var KssModifier = require('./kss_modifier'),
  KssParameter = require('./kss_parameter');

/**
 * The `kss/lib/kss_section` module is normally accessed via the
 * [`KssSection()`]{@link module:kss.KssSection} constructor of the `kss`
 * module:
 * ```
 * var KssSection = require('kss').KssSection;
 * ```
 * @private
 * @module kss/lib/kss_section
 */

var KssSection;

/**
 * Creates one section of a style guide.
 *
 * @constructor
 * @alias module:kss.KssSection
 * @param {Object} [data] The data to use to initialize the `KssSection` object.
 */
KssSection = function(data) {
  if (!(this instanceof KssSection)) {
    return new KssSection(data);
  }

  var self = this,
    custom;

  data = data || {};

  this.meta = {};
  this.meta.styleguide = data.styleguide || null;
  this.meta.raw = data.raw || '';
  this.meta.customPropertyNames = [];
  this.meta.depth = data.depth || 0;

  this.data = {};
  this.data.header = data.header || '';
  this.data.description = data.description || '';
  this.data.deprecated = data.deprecated ? true : false;
  this.data.experimental = data.experimental ? true : false;
  this.data.reference = data.reference || '';
  this.data.referenceURI = data.referenceURI || '';
  this.data.autoincrement = data.autoincrement || '';
  this.data.weight = data.weight || 0;
  this.data.markup = data.markup || '';

  if (data.modifiers) {
    this.data.modifiers = data.modifiers.map(function(modifier) {
      if (!(modifier instanceof KssModifier)) {
        modifier = new KssModifier(modifier);
      }
      return modifier.section(self);
    });
  } else {
    this.data.modifiers = [];
  }

  if (data.parameters) {
    this.data.parameters = data.parameters.map(function(parameter) {
      if (!(parameter instanceof KssParameter)) {
        parameter = new KssParameter(parameter);
      }
      return parameter.section(self);
    });
  } else {
    this.data.parameters = [];
  }

  // Find custom properties.
  for (custom in data) {
    if (data.hasOwnProperty(custom) && !this.meta.hasOwnProperty(custom) && !this.data.hasOwnProperty(custom)) {
      this.meta.customPropertyNames.push(custom);
      this.data[custom] = data[custom];
    }
  }
};

/**
 * Return the `KssSection` as a JSON object.
 *
 * @returns {Object} A JSON object representation of the KssSection.
 */
KssSection.prototype.toJSON = function() {
  var returnObject;

  /* eslint-disable key-spacing */
  returnObject = {
    header:          this.header(),
    description:     this.description(),
    deprecated:      this.deprecated(),
    experimental:    this.experimental(),
    reference:       this.reference(),
    referenceNumber: this.referenceNumber(),
    referenceURI:    this.referenceURI(),
    autoincrement:   this.autoincrement(),
    weight:          this.weight(),
    markup:          this.markup(),
    // Include meta as well.
    depth:           this.depth()
  };
  /* eslint-enable key-spacing */

  returnObject.modifiers = this.modifiers().map(function(modifier) {
    return modifier.toJSON();
  });
  returnObject.parameters = this.parameters().map(function(parameter) {
    return parameter.toJSON();
  });

  // Add custom properties to the JSON object.
  for (var i = 0; i < this.meta.customPropertyNames.length; i++) {
    // istanbul ignore else
    if (this.data[this.meta.customPropertyNames[i]]) {
      returnObject[this.meta.customPropertyNames[i]] = this.data[this.meta.customPropertyNames[i]];
    }
  }

  return returnObject;
};

/**
 * Gets or sets the `KssStyleGuide` object this `KssSection` is associated with.
 *
 * If the `styleguide` value is provided, the `KssStyleGuide` for this section
 * is set. Otherwise, the `KssStyleGuide` of the section is returned.
 *
 * @param {KssStyleGuide} [styleguide] Optional. The `KssStyleGuide` that owns the
 *   `KssSection`.
 * @returns {KssStyleGuide|KssSection} If styleguide is given, the current
 *   `KssSection` object is returned to allow chaining of methods. Otherwise,
 *   the `KssStyleGuide` object the section belongs to is returned.
 */
KssSection.prototype.styleguide = function(styleguide) {
  if (typeof styleguide === 'undefined') {
    return this.meta.styleguide;
  }

  this.meta.styleguide = styleguide;
  // Allow chaining.
  return this;
};

/**
 * Gets or sets the header of the section, i.e. the first line in the description.
 *
 * If the `header` value is provided, the `header` for this section is set.
 * Otherwise, the `header` of the section is returned.
 *
 * @param {string} [header] Optional. The header of the section.
 * @returns {KssSection|string} If `header` is given, the `KssSection` object is
 *   returned to allow chaining of methods. Otherwise, the header of the section
 *   is returned.
 */
KssSection.prototype.header = function(header) {
  if (typeof header === 'undefined') {
    return this.data.header;
  }

  this.data.header = header;
  // Allow chaining.
  return this;
};

/**
 * Gets or sets the description of the section.
 *
 * If the `description` value is provided, the `description` for this section is
 * set. Otherwise, the `description` of the section is returned.
 *
 * @param {string} [description] Optional. The description of the section.
 * @returns {KssSection|string} If `description` is given, the `KssSection`
 *   object is returned to allow chaining of methods. Otherwise, the description
 *   of the section is returned.
 */
KssSection.prototype.description = function(description) {
  if (typeof description === 'undefined') {
    return this.data.description;
  }

  this.data.description = description;
  // Allow chaining.
  return this;
};

/**
 * Gets or sets the deprecated flag for the section.
 *
 * If the `deprecated` value is provided, the `deprecated` flag for this section
 * is set. Otherwise, the `deprecated` flag for the section is returned.
 *
 * @param {boolean} [deprecated] Optional. The deprecated flag for the section.
 * @returns {KssSection|boolean} If `deprecated` is given, the `KssSection`
 *   object is returned to allow chaining of methods. Otherwise, the deprecated
 *   flag for the section is returned.
 */
KssSection.prototype.deprecated = function(deprecated) {
  if (typeof deprecated === 'undefined') {
    return this.data.deprecated;
  }

  this.data.deprecated = deprecated ? true : false;
  // Allow chaining.
  return this;
};

/**
 * Gets or sets the experimental flag for the section.
 *
 * If the `experimental` value is provided, the `experimental` flag for this
 * section is set. Otherwise, the `deprecated` flag for the section is returned.
 *
 * @param {boolean} [experimental] Optional. The experimental flag for the
 *   section.
 * @returns {KssSection|boolean} If `experimental` is given, the `KssSection`
 *   object is returned to allow chaining of methods. Otherwise, the
 *   experimental flag for the section is returned.
 */
KssSection.prototype.experimental = function(experimental) {
  if (typeof experimental === 'undefined') {
    return this.data.experimental;
  }

  this.data.experimental = experimental ? true : false;
  // Allow chaining.
  return this;
};

/**
 * Gets or sets the reference for the section.
 *
 * If the `reference` value is provided, the `reference` for this section is
 * set. Otherwise, the `reference` for the section is returned.
 *
 * @param {string} [reference] Optional. The reference of the section.
 * @returns {KssSection|string} If `reference` is given, the `KssSection` object
 *   is returned to allow chaining of methods. Otherwise, the reference for the
 *   section is returned.
 */
KssSection.prototype.reference = function(reference) {
  if (typeof reference === 'undefined') {
    return this.data.reference;
  }

  // @TODO: Tell the KssStyleGuide about the update.
  this.data.reference = reference;
  // Allow chaining.
  return this;
};

/**
 * Returns a numeric reference number for the section.
 *
 * If the section's given reference is already numeric (e.g. 2, 2.1.3, 3.2),
 * then this method returns the same value as reference() does. Otherwise, an
 * auto-incremented reference number will be returned.
 *
 * @returns {string} The reference number of the section.
 */
KssSection.prototype.referenceNumber = function() {
  // @TODO: The KssStyleGuide should globally determine which should be used
  // for the referenceNumber.
  var reference = this.reference();
  return (!this.autoincrement() || typeof reference === 'number' || typeof reference === 'string' && reference.match(/^[\.\d]+$/)) ? reference : this.autoincrement();
};

/**
 * Gets or sets the reference of the section, encoded as a valid URI fragment.
 *
 * If the `referenceURI` value is provided, the `referenceURI` for this section
 * is set. Otherwise, the `referenceURI` of the section is returned.
 *
 * @param {string} [referenceURI] Optional. The referenceURI of the section.
 * @returns {KssSection|string} If `referenceURI` is given, the `KssSection`
 *   object is returned to allow chaining of methods. Otherwise, the
 *   referenceURI of the section is returned.
 */
KssSection.prototype.referenceURI = function(referenceURI) {
  if (typeof referenceURI === 'undefined') {
    if (!this.data.referenceURI) {
      this.data.referenceURI = encodeURI(
        this.reference()
          .replace(/ \- /g, '-')
          .replace(/[^\w-]+/g, '-')
          .toLowerCase()
      );
    }
    return this.data.referenceURI;
  }

  this.data.referenceURI = referenceURI;
  // Allow chaining.
  return this;
};

/**
 * Gets or sets an auto-incremented reference number for the section.
 *
 * If the `autoincrement` value is provided, the `autoincrement` for this
 * section is set. Otherwise, the `autoincrement` of the section is returned.
 *
 * @param {string} [autoincrement] Optional. The auto-incremented reference number
 *   of the section.
 * @returns {KssSection|string} If `autoincrement` is given, the `KssSection`
 *   object is returned to allow chaining of methods. Otherwise, the
 *   auto-incremented reference number of the section is returned.
 */
KssSection.prototype.autoincrement = function(autoincrement) {
  // @TODO: Deprecate in favor of referenceNumber; stop parse() from always
  // adding autoincrement.
  if (typeof autoincrement === 'undefined') {
    return this.data.autoincrement;
  }

  this.data.autoincrement = autoincrement;
  // Allow chaining.
  return this;
};

/**
 * Gets or sets the weight of the section.
 *
 * If the `weight` value is provided, the `weight` for this section is set.
 * Otherwise, the `weight` of the section is returned.
 *
 * @param {integer} [weight] Optional. The weight of the section.
 * @returns {KssSection|integer} If `weight` is given, the `KssSection` object
 *   is returned to allow chaining of methods. Otherwise, the weight of the
 *   section is returned.
 */
KssSection.prototype.weight = function(weight) {
  if (typeof weight === 'undefined') {
    return this.data.weight;
  }

  this.data.weight = weight;
  // Allow chaining.
  return this;
};

/**
 * Gets or sets the depth of the section.
 *
 * If the `depth` value is provided, the `depth` for this section is set.
 * Otherwise, the `depth` of the section is returned.
 *
 * @param {integer} [depth] Optional. The depth of the section.
 * @returns {KssSection|integer} If `depth` is given, the `KssSection` object is
 *   returned to allow chaining of methods. Otherwise, the depth of the section
 *   is returned.
 */
KssSection.prototype.depth = function(depth) {
  // @TODO: Calculate this automatically based on reference and its delimiter.
  if (typeof depth === 'undefined') {
    return this.meta.depth;
  }

  this.meta.depth = depth;
  // Allow chaining.
  return this;
};

/**
 * Gets or sets the markup of the section.
 *
 * If the `markup` value is provided, the `markup` for this section is set.
 * Otherwise, the `markup` of the section is returned.
 *
 * @param {string} [markup] Optional. The markup of the section.
 * @returns {KssSection|string|false} If `markup` is given, the `KssSection` object is
 *   returned to allow chaining of methods. Otherwise, the markup of the section
 *   is returned, or `false` if none.
 */
KssSection.prototype.markup = function(markup) {
  if (typeof markup === 'undefined') {
    return this.data.markup;
  }

  this.data.markup = markup;
  // Allow chaining.
  return this;
};

/**
 * Gets or adds nested objects of the section.
 *
 * A common helper for `.modifiers()` and `.parameters()` methods.
 *
 * Different types of arguments for `properties` will yield different results:
 * - `Object|Array`: If the value is an array of objects or an object, the
 *   `properties` are added to this section.
 * - `undefined`: Pass nothing to return all of the section's properties in an
 *   array.
 * - `integer`: Use a 0-based index to return the section's Nth property.
 * - `string`: Use a string to return a specific modifier by name.
 *
 * @private
 * @param {string} propertyName The name of property in `KssSection`.
 * @param {Constructor} objectConstructor The constructor function for the type of object the property is.
 * @param {*} [properties] Optional. The properties to set for the section.
 * @returns {KssSection|Array|KssModifier|false} If `header` is given, the `KssSection` object is
 *   returned to allow chaining of methods. Otherwise, the header of the section
 *   is returned.
 */
KssSection.prototype._propertyHelper = function(propertyName, objectConstructor, properties) {
  var self = this,
    query, index;

  if (typeof properties === 'undefined') {
    return this.data[propertyName];
  }

  // If we are given an object, assign the properties.
  if (typeof properties === 'object') {
    if (!(properties instanceof Array)) {
      properties = [properties];
    }
    properties.map(function(property) {
      var newProperty = (property instanceof objectConstructor) ? property : new objectConstructor(property);
      newProperty.section(self);
      self.data[propertyName].push(newProperty);
    });
    // Allow chaining.
    return this;
  }

  // Otherwise, we should search for the requested property.
  query = properties;
  index = parseInt(query);
  if (typeof query === 'number' || typeof query === 'string' && query === (index + '')) {
    return (index < this.data[propertyName].length) ? this.data[propertyName][index] : false;
    // If the query can be converted to an integer, search by index instead.
  } else {
    // Otherwise, search for the property by name.
    for (var i = 0; i < this.data[propertyName].length; i++) {
      if (this.data[propertyName][i].name() === query) {
        return this.data[propertyName][i];
      }
    }
  }

  // No matching property found.
  return false;
};

/**
 * Gets or adds modifiers of the section.
 *
 * Different types of arguments will yield different results:
 *  - `modifiers(Object|Array)`: If the value is an array of objects or an
 *    object, the `modifiers` are added to this section.
 * - `modifiers()`: Pass nothing to return all of the section's modifiers in an
 *   array.
 * - `modifiers(Integer)`: Use a 0-based index to return the section's Nth
 *   modifier.
 * - `modifiers(String)`: Use a string to return a specific modifier by name.
 *
 * @param {*} [modifiers] Optional. The modifiers of the section.
 * @returns {KssSection|Array|KssModifier|false} If `header` is given, the `KssSection` object is
 *   returned to allow chaining of methods. Otherwise, the header of the section
 *   is returned.
 */
KssSection.prototype.modifiers = function(modifiers) {
  return this._propertyHelper('modifiers', KssModifier, modifiers);
};

/**
 * Gets or adds parameters if the section is a CSS preprocessor function/mixin.
 *
 * Different types of arguments will yield different results:
 *  - `parameters(Object|Array)`: If the value is an array of objects or an
 *    object, the `parameters` are added to this section.
 * - `parameters()`: Pass nothing to return all of the section's parameters in
 *   an array.
 * - `parameters(Integer)`: Use a 0-based index to return the section's Nth
 *   parameter.
 * - `parameters(String)`: Use a string to return a specific parameter by name.
 *
 * @param {*} [parameters] Optional. The parameters of the section.
 * @returns {KssSection|Array|KssParameter|false} If `header` is given, the `KssSection` object is
 *   returned to allow chaining of methods. Otherwise, the header of the section
 *   is returned.
 */
KssSection.prototype.parameters = function(parameters) {
  return this._propertyHelper('parameters', KssParameter, parameters);
};

module.exports = KssSection;
