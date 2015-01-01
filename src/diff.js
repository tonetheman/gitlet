var index = require("./index");
var objects = require("./objects");
var refs = require("./refs");
var util = require("./util");

var diff = module.exports = {
  FILE_STATUS: { ADD: "A", MODIFY: "M", DELETE: "D", SAME: "SAME", CONFLICT: "CONFLICT" },

  readDiff: function(hash1, hash2) {
    var a = hash1 === undefined ? index.readToc() : objects.readCommitToc(hash1);
    var b = hash2 === undefined ? index.readWorkingCopyToc() : objects.readCommitToc(hash2);
    return diff.nameStatus(a, b);
  },

  nameStatus: function(receiver, giver) {
    var tocDiff = diff.diff(receiver, giver);
    return Object.keys(tocDiff)
      .filter(function(p) { return tocDiff[p].status !== diff.FILE_STATUS.SAME; })
      .reduce(function(ns, p) { return util.assocIn(ns, [p, tocDiff[p].status]); }, {});
  },

  diff: function(receiver, giver) {
    return diff.diffWithBase(receiver, receiver, giver);
  },

  diffWithBase: function(receiver, base, giver) {
    var paths = Object.keys(receiver).concat(Object.keys(base)).concat(Object.keys(giver));
    return util.unique(paths).reduce(function(idx, p) {
      return util.assocIn(idx, [p, {
        status: fileStatus(receiver[p], base[p], giver[p]),
        receiver: receiver[p],
        base: base[p],
        giver: giver[p]
      }]);
    }, {});
  },

  readChangedFilesCommitWouldOverwrite: function(hash) {
    var headHash = refs.readHash("HEAD");
    var localChanges = diff.readDiff(headHash);
    var headToBranchChanges = diff.readDiff(headHash, hash);
    return Object.keys(localChanges)
      .filter(function(path) { return path in headToBranchChanges; });
  },
};

function fileStatus(receiver, base, giver) {
  var receiverPresent = receiver !== undefined;
  var basePresent = base !== undefined;
  var giverPresent = giver !== undefined;
  if (receiverPresent && giverPresent && receiver !== giver) {
    if (receiver !== base && giver !== base) {
      return diff.FILE_STATUS.CONFLICT;
    } else {
      return diff.FILE_STATUS.MODIFY;
    }
  } else if (receiver === giver) {
    return diff.FILE_STATUS.SAME;
  } else if ((!receiverPresent && !basePresent && giverPresent) ||
             (receiverPresent && !basePresent && !giverPresent)) {
    return diff.FILE_STATUS.ADD;
  } else if ((receiverPresent && basePresent && !giverPresent) ||
             (!receiverPresent && basePresent && giverPresent)) {
    return diff.FILE_STATUS.DELETE;
  }
};
