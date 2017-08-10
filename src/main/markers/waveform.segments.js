/**
 * @file
 *
 * Defines the {@link WaveformSegments} class.
 *
 * @module peaks/markers/waveform.segments
 */
define([
  'konva',
  'peaks/waveform/waveform.utils',
  'peaks/markers/shapes/wave'
], function(Konva, Utils, SegmentShape) {
  'use strict';

  /**
   * Handles all functionality related to the adding, removing and manipulation
   * of segments.
   *
   * @class
   * @alias WaveformSegments
   *
   * @param {Peaks} peaks The parent Peaks object.
   */
  function WaveformSegments(peaks) {
    var self = this;

    self.peaks = peaks;
    self.segments = [];

    var views = [
      peaks.waveform.waveformZoomView,
      peaks.waveform.waveformOverview
    ];

    self.views = views.map(function(view) {
      if (!view.segmentLayer) {
        view.segmentLayer = new Konva.Layer();
        view.stage.add(view.segmentLayer);
        view.segmentLayer.moveToTop();
      }

      return view;
    });

    self._segmentIdCounter = 0;
  }

  WaveformSegments.prototype.getNextSegmentId = function() {
    return 'peaks.segment.' + this._segmentIdCounter++;
  };

  WaveformSegments.prototype.createSegmentWaveform = function(options) {
    var self = this;

    var segment = {
      startTime: options.startTime,
      endTime: options.endTime,
      labelText: options.labelText || '',
      color: options.color || this.getSegmentColor(),
      editable: options.editable || false
    };

    if (options.id !== undefined && options.id !== null) {
      segment.id = options.id;
    }
    else {
      segment.id = this.getNextSegmentId();
    }

    var segmentZoomGroup = new Konva.Group();
    var segmentOverviewGroup = new Konva.Group();

    var segmentGroups = [segmentZoomGroup, segmentOverviewGroup];

    segmentGroups.forEach(function(segmentGroup, i) {
      var view = self.views[i];

      var SegmentLabel = self.peaks.options.segmentLabelDraw;
      var SegmentMarkerIn = self.peaks.options.segmentInMarker;
      var SegmentMarkerOut = self.peaks.options.segmentOutMarker;

      segmentGroup.waveformShape = SegmentShape.createShape(segment, view);

      segmentGroup.waveformShape.on('mouseenter', function onMouseEnter(event) {
        event.target.parent.label.show();
        event.target.parent.view.segmentLayer.draw();
      });

      segmentGroup.waveformShape.on('mouseleave', function onMouseLeave(event) {
        event.target.parent.label.hide();
        event.target.parent.view.segmentLayer.draw();
      });

      segmentGroup.add(segmentGroup.waveformShape);

      segmentGroup.label = new SegmentLabel(segmentGroup, segment);
      segmentGroup.add(segmentGroup.label.hide());

      if (segment.editable) {
        var draggable = true;

        segmentGroup.inMarker = new SegmentMarkerIn(
          draggable,
          segmentGroup,
          segment,
          self.segmentHandleDrag.bind(self)
        );

        segmentGroup.add(segmentGroup.inMarker);

        segmentGroup.outMarker = new SegmentMarkerOut(
          draggable,
          segmentGroup,
          segment,
          self.segmentHandleDrag.bind(self)
        );

        segmentGroup.add(segmentGroup.outMarker);
      }

      view.segmentLayer.add(segmentGroup);
    });

    segment.zoom = segmentZoomGroup;
    segment.zoom.view = this.peaks.waveform.waveformZoomView;
    segment.overview = segmentOverviewGroup;
    segment.overview.view = this.peaks.waveform.waveformOverview;

    return segment;
  };

  WaveformSegments.prototype.updateSegmentWaveform = function(segment) {
    var waveformOverview = this.peaks.waveform.waveformOverview;
    var waveformZoomView = this.peaks.waveform.waveformZoomView;
    var inMarker = segment.overview.inMarker;
    var outMarker = segment.overview.outMarker;

    // Overview
    var overviewStartOffset = waveformOverview.data.at_time(segment.startTime);
    var overviewEndOffset   = waveformOverview.data.at_time(segment.endTime);

    segment.overview.setWidth(overviewEndOffset - overviewStartOffset);

    if (segment.editable) {
      if (inMarker) {
        inMarker.setX(overviewStartOffset - inMarker.getWidth());

        inMarker.label.setText(Utils.formatTime(segment.startTime, false));

        inMarker.show();
      }

      if (outMarker) {
        outMarker.setX(overviewEndOffset);

        outMarker.label.setText(Utils.formatTime(segment.endTime, false));

        outMarker.show();
      }
    }

    // Label
    // segment.overview.label.setX(overviewStartOffset);

    // Zoom
    var zoomStartOffset = waveformZoomView.data.at_time(segment.startTime);
    var zoomEndOffset   = waveformZoomView.data.at_time(segment.endTime);

    var frameStartOffset = waveformZoomView.frameOffset;
    var frameEndOffset   = waveformZoomView.frameOffset + waveformZoomView.width;

    if (zoomStartOffset < frameEndOffset && zoomStartOffset < zoomEndOffset) {
      // Segment is visible - see http://wiki.c2.com/?TestIfDateRangesOverlap
      var startPixel = zoomStartOffset - frameStartOffset;
      var endPixel   = zoomEndOffset   - frameStartOffset;

      segment.zoom.show();

      if (segment.editable) {
        if (segment.zoom.inMarker) {
          segment.zoom.inMarker.setX(startPixel - segment.zoom.inMarker.getWidth());

          segment.zoom.inMarker.label.setText(Utils.formatTime(segment.startTime, false));

          segment.zoom.inMarker.show();
        }

        if (segment.zoom.outMarker) {
          segment.zoom.outMarker.setX(endPixel);

          segment.zoom.outMarker.label.setText(Utils.formatTime(segment.endTime, false));

          segment.zoom.outMarker.show();
        }
      }
    }
    else {
      segment.zoom.hide();
    }
  };

  WaveformSegments.prototype.segmentHandleDrag = function(thisSeg, segment) {
    if (thisSeg.inMarker.getX() > 0) {
      var inOffset = thisSeg.view.frameOffset +
                     thisSeg.inMarker.getX() +
                     thisSeg.inMarker.getWidth();

      segment.startTime = thisSeg.view.data.time(inOffset);
    }

    if (thisSeg.outMarker.getX() < thisSeg.view.width) {
      var outOffset = thisSeg.view.frameOffset + thisSeg.outMarker.getX();

      segment.endTime = thisSeg.view.data.time(outOffset);
    }

    this.peaks.emit('segments.dragged', segment);

    this.updateSegmentWaveform(segment);
    this.render();
  };

  function g() {
    return Math.floor(Math.random() * 255);
  }

  WaveformSegments.prototype.getSegmentColor = function() {
    if (this.peaks.options.randomizeSegmentColor) {
      return 'rgba(' + g() + ', ' + g() + ', ' + g() + ', 1)';
    }
    else {
      return this.peaks.options.segmentColor;
    }
  };

  WaveformSegments.prototype.init = function() {
    this.peaks.on('zoomview.displaying', this.updateSegments.bind(this));
    this.peaks.emit('segments.ready');
  };

  /**
   * Update the segment positioning accordingly to each view zoom level and so on.
   *
   * Also performs the rendering.
   *
   * @api
   */
  WaveformSegments.prototype.updateSegments = function() {
    this.segments.forEach(this.updateSegmentWaveform.bind(this));
    this.render();
  };

  /**
   * Manage a new segment and propagates it into the different views
   *
   * @api
   * @param {Object} options
   * @param {Number} options.startTime
   * @param {Number} options.endTime
   * @param {Boolean=} options.editable
   * @param {String=} options.color
   * @param {String=} options.labelText
   * @param {Number=} options.id
   * @return {Object}
   */
  WaveformSegments.prototype._createSegment = function(options) {
    // Watch for anyone still trying to use the old
    // createSegment(startTime, endTime, ...) API
    if (!Utils.isObject(options)) {
      // eslint-disable-next-line max-len
      throw new TypeError('peaks.segments.add(): expected a Segment object parameter');
    }

    if (!Utils.isValidTime(options.startTime)) {
      // eslint-disable-next-line max-len
      throw new TypeError('peaks.segments.add(): startTime should be a valid number');
    }

    if (!Utils.isValidTime(options.endTime)) {
      // eslint-disable-next-line max-len
      throw new TypeError('peaks.segments.add(): endTime should be a valid number');
    }

    if (options.startTime < 0) {
      // eslint-disable-next-line max-len
      throw new RangeError('peaks.segments.add(): startTime should not be negative');
    }

    if (options.endTime < 0) {
      // eslint-disable-next-line max-len
      throw new RangeError('peaks.segments.add(): endTime should not be negative');
    }

    if (options.endTime <= options.startTime) {
      // eslint-disable-next-line max-len
      throw new RangeError('peaks.segments.add(): endTime should be greater than startTime');
    }

    var segment = this.createSegmentWaveform(options);

    this.updateSegmentWaveform(segment);
    this.segments.push(segment);

    return segment;
  };

  WaveformSegments.prototype.getSegments = function() {
    return this.segments;
  };

  WaveformSegments.prototype.getSegment = function(id) {
    // TODO: Need a better algorithm
    for (var i = 0; i < this.segments.length; i++) {
      if (this.segments[i].id === id) {
        return this.segments[i];
      }
    }

    throw new Error("peaks.segments.getSegment(): segment '" + id + "' not found");
  };

  WaveformSegments.prototype.add = function(segmentOrSegments) {
    var segments = Array.isArray(arguments[0]) ?
                   arguments[0] :
                   Array.prototype.slice.call(arguments);

    if (typeof segments[0] === 'number') {
      // eslint-disable-next-line max-len
      this.peaks.options.deprecationLogger('peaks.segments.add(): expected a segment object or an array');

      segments = [{
        startTime: arguments[0],
        endTime:   arguments[1],
        editable:  arguments[2],
        color:     arguments[3],
        labelText: arguments[4]
      }];
    }

    segments.forEach(this._createSegment.bind(this));
    this.render();
  };

  /**
   * @private
   */
  WaveformSegments.prototype._remove = function(segment) {
    var index = null;

    this.segments.some(function(s, i) {
      if (s === segment) {
        index = i;

        return true;
      }
    });

    if (index !== null) {
      segment = this.segments[index];

      segment.overview.destroy();
      segment.zoom.destroy();
    }

    return index;
  };

  WaveformSegments.prototype.remove = function(segment) {
    var index = this._remove(segment);

    if (index === null) {
      // eslint-disable-next-line max-len
      throw new Error('peaks.segments.remove(): Unable to find the segment: ' + String(segment));
    }

    this.updateSegments();

    return this.segments.splice(index, 1).pop();
  };

  WaveformSegments.prototype.removeById = function(segmentId) {
    this.segments.filter(function(segment) {
      return segment.id === segmentId;
    }).forEach(this.remove.bind(this));
  };

  WaveformSegments.prototype.removeByTime = function(startTime, endTime) {
    endTime = (typeof endTime === 'number') ? endTime : 0;

    var fnFilter;

    if (endTime > 0) {
      fnFilter = function(segment) {
        return segment.startTime === startTime && segment.endTime === endTime;
      };
    }
    else {
      fnFilter = function(segment) {
        return segment.startTime === startTime;
      };
    }

    var matchingSegments = this.segments.filter(fnFilter);

    matchingSegments.forEach(this.remove.bind(this));

    return matchingSegments.length;
  };

  WaveformSegments.prototype.removeAll = function() {
    this.views.forEach(function(view) {
      view.segmentLayer.removeChildren();
    });

    this.segments = [];

    this.render();
  };

  /**
   * Performs the rendering of the segments on screen
   *
   * @api
   * @see https://github.com/bbc/peaks.js/pull/5
   * @since 0.0.2
   */
  WaveformSegments.prototype.render = function() {
    this.views.forEach(function(view) {
      view.segmentLayer.draw();
    });
  };

  return WaveformSegments;
});
