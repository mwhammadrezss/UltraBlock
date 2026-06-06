/**
 * UltraBlock Scriptlet: json-prune
 * Based on: AdGuard Scriptlets / uBlock Origin
 * Wraps JSON.parse and Response.prototype.json to remove specified
 * properties from parsed JSON objects.
 *
 * @param {Object} args
 * @param {string} args.propsToRemove - Space-separated property names/paths to remove (e.g., 'adPlacements playerAds ads.config')
 * @param {string} [args.requiredInitialProps] - Space-separated props that MUST exist for pruning to apply (validation)
 */
function jsonPrune(args) {
  'use strict';

  if (!args || !args.propsToRemove) return;

  var propsToRemove = args.propsToRemove.split(/\s+/);
  var requiredProps = (args.requiredInitialProps || '').split(/\s+/).filter(Boolean);

  function findAndDelete(obj, path) {
    if (!obj || typeof obj !== 'object') return;

    var parts = path.split('.');
    var current = obj;

    for (var i = 0; i < parts.length - 1; i++) {
      var part = parts[i];
      if (part === '*') {
        // Wildcard: apply to all child objects
        var remaining = parts.slice(i + 1).join('.');
        var keys = Object.keys(current);
        for (var k = 0; k < keys.length; k++) {
          if (current[keys[k]] && typeof current[keys[k]] === 'object') {
            findAndDelete(current[keys[k]], remaining);
          }
        }
        return;
      }
      if (current[part] === undefined || current[part] === null) return;
      current = current[part];
      if (typeof current !== 'object') return;
    }

    var lastPart = parts[parts.length - 1];
    if (lastPart === '*') {
      // Delete all properties
      var allKeys = Object.keys(current);
      for (var j = 0; j < allKeys.length; j++) {
        delete current[allKeys[j]];
      }
    } else if (lastPart.indexOf('[]') !== -1) {
      // Array handling: prop[] means prop is an array, empty it
      var arrProp = lastPart.replace('[]', '');
      if (Array.isArray(current[arrProp])) {
        current[arrProp] = [];
      }
    } else {
      delete current[lastPart];
    }
  }

  function hasProp(obj, path) {
    if (!obj || typeof obj !== 'object') return false;
    var parts = path.split('.');
    var current = obj;
    for (var i = 0; i < parts.length; i++) {
      if (current === undefined || current === null) return false;
      if (typeof current !== 'object') return false;
      if (!(parts[i] in current)) return false;
      current = current[parts[i]];
    }
    return true;
  }

  function pruneObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    // Check required props exist (if specified)
    if (requiredProps.length > 0) {
      for (var r = 0; r < requiredProps.length; r++) {
        if (!hasProp(obj, requiredProps[r])) return obj;
      }
    }

    // Remove specified props
    for (var i = 0; i < propsToRemove.length; i++) {
      findAndDelete(obj, propsToRemove[i]);
    }

    return obj;
  }

  // Hook JSON.parse
  var _origJSONParse = JSON.parse;
  JSON.parse = function parse(text, reviver) {
    var result = _origJSONParse.call(JSON, text, reviver);
    try {
      result = pruneObject(result);
    } catch (e) {}
    return result;
  };
  JSON.parse.toString = function() { return 'function parse() { [native code] }'; };

  // Hook Response.prototype.json
  if (typeof Response !== 'undefined' && Response.prototype) {
    var _origResponseJson = Response.prototype.json;
    Response.prototype.json = function json() {
      return _origResponseJson.call(this).then(function(data) {
        try {
          data = pruneObject(data);
        } catch (e) {}
        return data;
      });
    };
    Response.prototype.json.toString = function() { return 'function json() { [native code] }'; };
  }
}
