var defnode = require('defnode'), tern = require('tern'), walk = require('acorn/util/walk'), walkall = require('walkall');

tern.registerPlugin('local-scope-condense', function(server, options) {
  function visitScope(state, scope, path) {
    // detect cycles
    if (scope._localScopeCondenseSeen) return;
    scope._localScopeCondenseSeen = true;

    for (var prop in scope.props) {
      visitAVal(state, scope.props[prop], joinPaths(path, prop));
    }
  }

  function visitNode(state, node, path) {
    var i = 0;
    walk.simple(node, walkall.makeVisitors(function(node) {
      if (node.scope) visitScope(state, node.scope, joinPaths(path, '' + i++));
    }));
  }

  function visitAVal(state, av, path) {
    if (!state.isTarget(av.origin)) return;
    state.types[path] = {
      type: av,
      span: state.getSpan(av),
      doc: av.doc,
      data: av.metaData,
    };
    if (av.originNode) {
      var defNode = defnode.findDefinitionNode(av.originNode.sourceFile.ast, av.originNode.start, av.originNode.end);
      if (defNode) visitNode(state, defNode, path);
    }
  }

  var locals = [];
  return {
    passes: {
      postCondenseReach: function(state) {
        // Traverse accessible types first so we name things with reachable path
        // prefixes if possible.
        Object.keys(state.types).forEach(function(path) {
          var data = state.types[path];
          if (data.type.originNode) {
            visitNode(state, data.type.originNode, joinPaths(path, '!local'));
          }
        });

        state.cx.parent.files.forEach(function(file) {
          var path = '!local.' + file.name.replace(/\./g, '`');
          visitScope(state, file.scope, path);
          if (state.isTarget(file.name)) visitNode(state, file.ast, path);
        });
      },
    },
  };
});

function joinPaths(a, b) {
  if (a) return a + '.' + b;
  else return b;
}