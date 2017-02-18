/* ======= Global Utilities ======= */

/**
 * Logs a Message
 * @param {String} msg
 */
var log = function(msg) {
  if(!Moon.config.silent) console.log(msg);
}

/**
 * Throws an Error
 * @param {String} msg
 */
var error = function(msg) {
  console.error("[Moon] ERR: " + msg);
}

/**
 * Adds DOM Updates to Queue
 * @param {Object} instance
 * @param {String} key
 * @param {Any} val
 */
var queueBuild = function(instance) {
  if(!instance.$queued && !instance.$destroyed) {
    instance.$queued = true;
    setTimeout(function() {
      instance.build();
      callHook(instance, 'updated');
      instance.$queued = false;
    }, 0);
  }
}

/**
 * Converts attributes into key-value pairs
 * @param {Node} node
 * @return {Object} Key-Value pairs of Attributes
 */
var extractAttrs = function(node) {
  var attrs = {};
  for(var rawAttrs = node.attributes, i = rawAttrs.length; i--;) {
    attrs[rawAttrs[i].name] = rawAttrs[i].value;
  }
  return attrs;
}

/**
 * Gives Default Metadata for a VNode
 * @return {Object} metadata
 */
var defaultMetadata = function() {
  return {
    shouldRender: true,
    component: false,
    eventListeners: {}
  }
}

/**
 * Escapes a String
 * @param {String} str
 */
var escapeString = function(str) {
	var NEWLINE_RE = /\n/g;
	var DOUBLE_QUOTE_RE = /"/g;
  return str.replace(NEWLINE_RE, "\\n").replace(DOUBLE_QUOTE_RE, "\\\"");
}

/**
 * Resolves an Object Keypath and Sets it
 * @param {Object} obj
 * @param {String} keypath
 * @param {String} val
 * @return {Object} resolved object
 */
var resolveKeyPath = function(obj, keypath, val) {
  var i;
  var path = keypath.split(".");
  for(i = 0; i < path.length - 1; i++) {
    var propName = path[i];
    obj = obj[propName];
  }
  obj[path[i]] = val;
  return obj;
}

/**
 * Compiles a Template
 * @param {String} template
 * @param {Boolean} isString
 * @return {String} compiled template
 */
var compileTemplate = function(template, isString) {
  var TEMPLATE_RE = /{{([A-Za-z0-9_]+)([A-Za-z0-9_.()'"+\-*/\s\[\]]+)?}}/gi;
  var compiled = template;
  template.replace(TEMPLATE_RE, function(match, key, modifiers) {
    if(!modifiers) {
      modifiers = '';
    }
    if(isString) {
      compiled = compiled.replace(match, `" + instance.get("${key}")${modifiers} + "`);
    } else {
      compiled = compiled.replace(match, `instance.get("${key}")${modifiers}`);
    }
  });
  return compiled;
}

/**
 * Extracts the Slots From Component Children
 * @param {Array} children
 * @return {Object} extracted slots
 */
var getSlots = function(children) {
  var slots = {};

  // No Children Means No Slots
  if(!children) {
    return slots;
  }

  var defaultSlotName = "default";
  slots[defaultSlotName] = [];

  for(var i = 0; i < children.length; i++) {
    var child = children[i];
    if(child.props.slot) {
      if(!slots[child.props.slot]) {
        slots[child.props.slot] = [child];
      } else {
        slots[child.props.slot].push(child);
      }
      delete child.props.slot;
    } else {
      slots[defaultSlotName].push(child);
    }
  }

  return slots;
}

/**
 * Creates a Virtual DOM Node
 * @param {String} type
 * @param {String} val
 * @param {Object} props
 * @param {Array} children
 * @param {Object} meta
 * @return {Object} Virtual DOM Node
 */
var createElement = function(type, val, props, children, meta) {
  return {
    type: type,
    val: val,
    props: props,
    children: children,
    meta: meta || defaultMetadata()
  };
}

/**
 * Creates a Component
 * @param {String} type
 * @param {Object} props
 * @param {Object} meta
 * @param {Array} children
 * @param {Object} component
 * @return {Object} Virtual DOM Node
 */
var createComponent = function(type, props, meta, children, component) {
  if(component.opts.functional) {
    return createFunctionalComponent(type, props, meta, children, component);
  }
}

/**
 * Creates a Functional Component
 * @param {String} type
 * @param {Object} props
 * @param {Object} meta
 * @param {Array} children
 * @param {Object} functionalComponent
 * @return {Object} Virtual DOM Node
 */
var createFunctionalComponent = function(type, props, meta, children, functionalComponent) {
  var data = functionalComponent.opts.data || {};
  // Merge data with provided props
  if(functionalComponent.opts.props) {
    for(var i = 0; i < functionalComponent.opts.props.length; i++) {
      var prop = functionalComponent.opts.props[i];
      data[prop] = props[prop];
    }
  }
  return functionalComponent.opts.render(h, {
    data: data,
    slots: getSlots(children)
  });
}

/**
 * Normalizes Children
 * @param {*} children
 * @return {Object} Normalized Child
 */
 var normalizeChildren = function(children) {
   var normalizedChildren = [];
   for(var i = 0; i < children.length; i++) {
     var child = children[i];
     if(Array.isArray(child)) {
       normalizedChildren = normalizedChildren.concat(normalizeChildren(child));
     } else if(typeof child === "string" || child === null) {
       normalizedChildren.push(createElement("#text", child || "", {}, [], defaultMetadata()));
     } else {
       normalizedChildren.push(child);
     }
   }
   return normalizedChildren;
 }

/**
 * Compiles Arguments to a VNode
 * @param {String} tag
 * @param {Object} attrs
 * @param {Object} meta
 * @param {Array} children
 * @return {String} Object usable in Virtual DOM (VNode)
 */
var h = function() {
  var args = Array.prototype.slice.call(arguments);
  var tag = args.shift();
  var attrs = args.shift() || {};
  var meta = args.shift();
  var children = normalizeChildren(args);
  // It's a Component
  if(components[tag]) {
    return createComponent(tag, attrs, meta, children, components[tag]);
  }
  return createElement(tag, children.join(""), attrs, children, meta);
};

/**
 * Adds metadata Event Listeners to an Element
 * @param {Object} node
 * @param {Object} vnode
 * @param {Object} instance
 */
var addEventListeners = function(node, vnode, instance) {
  var eventListeners = vnode.meta.eventListeners;
  for(var type in eventListeners) {
    for(var i = 0; i < eventListeners[type].length; i++) {
      var method = eventListeners[type][i];
      node.addEventListener(type, method);
    }
  }
}

/**
 * Creates DOM Node from VNode
 * @param {Object} vnode
 * @param {Object} instance
 * @return {Object} DOM Node
 */
var createNodeFromVNode = function(vnode, instance) {
  var el;

  if(vnode.type === "#text") {
    el = document.createTextNode(vnode.val);
  } else {
    el = document.createElement(vnode.type);
    for(var i = 0; i < vnode.children.length; i++) {
      el.appendChild(createNodeFromVNode(vnode.children[i], instance));
    }
    addEventListeners(el, vnode, instance);
  }
  diffProps(el, {}, vnode, vnode.props);
  return el;
}

/**
 * Diffs Props of Node and a VNode, and apply Changes
 * @param {Object} node
 * @param {Object} nodeProps
 * @param {Object} vnode
 * @param {Object} vnodeProps
 */
var diffProps = function(node, nodeProps, vnode, vnodeProps) {
  // Get object of all properties being compared
  var allProps = merge(nodeProps, vnodeProps);

  for(var propName in allProps) {
    // If not in VNode or is a Directive, remove it
    if(!vnodeProps[propName] || directives[propName] || specialDirectives[propName]) {
      // If it is a directive, run the directive
      if(directives[propName]) {
        directives[propName](node, allProps[propName], vnode);
      }
      node.removeAttribute(propName);
    } else if(!nodeProps[propName] || nodeProps[propName] !== vnodeProps[propName]) {
      // It has changed or is not in the node in the first place
      node.setAttribute(propName, vnodeProps[propName]);
    }
  }
}

/**
 * Diffs Node and a VNode, and applies Changes
 * @param {Object} node
 * @param {Object} vnode
 * @param {Object} parent
 * @param {Object} instance
 * @return {Object} adjusted node only if it was replaced
 */
var diff = function(node, vnode, parent, instance) {
  var nodeName;

  if(node) {
    nodeName = node.nodeName.toLowerCase();
  }

  if(!node && vnode && vnode.meta.shouldRender) {
    // No Node, create a node
    var newNode = createNodeFromVNode(vnode, instance);
    parent.appendChild(newNode);
    return newNode;
  } else if(!vnode) {
    // No vnode, remove the node
    parent.removeChild(node);
    return null;
  } else if(nodeName !== vnode.type) {
    // Different types, replace it
    var newNode = createNodeFromVNode(vnode, instance);
    parent.replaceChild(newNode, node);
    return newNode;
  } else if(vnode.type === "#text" && nodeName === "#text") {
    // Both are textnodes, update the node
    node.textContent = vnode.val;
    return node;
  } else if(vnode && vnode.meta.shouldRender) {
    // Children May have Changed

    // Diff props
    var nodeProps = extractAttrs(node);
    diffProps(node, nodeProps, vnode, vnode.props);

    // Add initial event listeners (done once)
    if(instance.$initialRender) {
      addEventListeners(node, vnode, instance);
    }

    // Diff Children
    var currentChildNode = node.firstChild;
    for(var i = 0; i < vnode.children.length || currentChildNode; i++) {
      var next = currentChildNode ? currentChildNode.nextSibling : null;
      var newNode = diff(currentChildNode, vnode.children[i], node, instance);
      currentChildNode = next;
    }
  }
}


/**
 * Extends an Object with another Object's properties
 * @param {Object} parent
 * @param {Object} child
 * @return {Object} Extended Parent
 */
var extend = function(parent, child) {
  for (var key in child) {
    parent[key] = child[key];
  }
  return parent;
}

/**
 * Merges Two Objects Together
 * @param {Object} parent
 * @param {Object} child
 * @return {Object} Merged Object
 */
var merge = function(parent, child) {
  var merged = {};
  for(var key in parent) {
    merged[key] = parent[key];
  }
  for (var key in child) {
    merged[key] = child[key];
  }
  return merged;
}

/**
 * Calls a Hook
 * @param {Object} instance
 * @param {String} name
 */
var callHook = function(instance, name) {
  var hook = instance.$hooks[name];
  if(hook) {
    hook();
  }
}

/**
 * Does No Operation
 */
var noop = function() {

}
