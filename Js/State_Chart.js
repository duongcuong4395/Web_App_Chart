function init() 
{
	
    var $ = go.GraphObject.make;  // for conciseness in defining templates

	myDiagram = 
	$(go.Diagram, "DiagramDiv",  // must name or refer to the DIV HTML element 
		{
			// start everything in the middle of the viewport
			initialContentAlignment: go.Spot.Center,
			// have mouse wheel events zoom in and out instead of scroll up and down
			"toolManager.mouseWheelBehavior": go.ToolManager.WheelZoom,
			// support double-click in background creating a new node
			"clickCreatingTool.archetypeNodeData": { text: "new node" },
			
			"commandHandler.archetypeGroupData": { isGroup: true, category: "OfNodes" },
			// enable undo & redo
			"undoManager.isEnabled": true
        }
	);
	
	// define the Node template
    myDiagram.nodeTemplate =
    $(go.Node, "Auto",  {
			selectionObjectName: "TEXT",
			rotatable: true},
			new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
        // define the node's outer shape, which will surround the TextBlock
        $(go.Shape, "RoundedRectangle", {
				name: "SHAPE", 
				parameter1: 20,  // the corner has a large radius
				fill: $(go.Brush, "Linear", { 0: "rgb(254, 201, 0)", 1: "rgb(254, 162, 0)" }),
				portId: "",  // this Shape is the Node's port, not the whole Node
				fromLinkable: true,
				fromLinkableSelfNode: true, 
				fromLinkableDuplicates: true,
				toLinkable: true, 
				toLinkableSelfNode: true, 
				toLinkableDuplicates: true,
				cursor: "pointer"
			},
			
			new go.Binding("fill", "fill").makeTwoWay()
		),
		
        $(go.TextBlock,
			{
				font: "bold 11pt helvetica, bold arial, sans-serif",
				editable: true  // editing the text automatically updates the model data
			},
			new go.Binding("text").makeTwoWay()
		)
    );
	
	// this function is used to highlight a Group that the selection may be dropped into
    function highlightGroup(e, grp, show) {
		if (!grp) return;
		e.handled = true;
		if (show) {
			// cannot depend on the grp.diagram.selection in the case of external drag-and-drops;
			// instead depend on the DraggingTool.draggedParts or .copiedParts
			var tool = grp.diagram.toolManager.draggingTool;
			var map = tool.draggedParts || tool.copiedParts;  // this is a Map
			// now we can check to see if the Group will accept membership of the dragged Parts
			if (grp.canAddMembers(map.toKeySet())) {
				grp.isHighlighted = true;
				return;
			}
		}
		grp.isHighlighted = false;
    }
	
	// Upon a drop onto a Group, we try to add the selection as members of the Group.
    // Upon a drop onto the background, or onto a top-level Node, make selection top-level.
    // If this is OK, we're done; otherwise we cancel the operation to rollback everything.
    function finishDrop(e, grp) {
      var ok = (grp !== null
                ? grp.addMembers(grp.diagram.selection, true)
                : e.diagram.commandHandler.addTopLevelParts(e.diagram.selection, true));
      if (!ok) e.diagram.currentTool.doCancel();
    }
	
	myDiagram.groupTemplateMap.add("OfNodes",
    $(go.Group, "Auto",
        {
          background: "transparent",
          ungroupable: true,
          // highlight when dragging into the Group
          mouseDragEnter: function(e, grp, prev) { highlightGroup(e, grp, true); },
          mouseDragLeave: function(e, grp, next) { highlightGroup(e, grp, false); },
          computesBoundsAfterDrag: true,
          // when the selection is dropped into a Group, add the selected Parts into that Group;
          // if it fails, cancel the tool, rolling back any changes
          mouseDrop: finishDrop,
          handlesDragDropForMembers: true,  // don't need to define handlers on member Nodes and Links
          // Groups containing Nodes lay out their members vertically
          layout:
            $(go.GridLayout,
              { wrappingColumn: 1, alignment: go.GridLayout.Position,
                  cellSize: new go.Size(1, 1), spacing: new go.Size(4, 4) })
        },
        new go.Binding("background", "isHighlighted", function(h) { return h ? "rgba(255,0,0,0.2)" : "transparent"; }).ofObject(),
        $(go.Shape, "Rectangle",
          { fill: null, stroke: "#0099CC", strokeWidth: 2 }),
        $(go.Panel, "Vertical",  // title above Placeholder
          $(go.Panel, "Horizontal",  // button next to TextBlock
            { stretch: go.GraphObject.Horizontal, background: "#33D3E5", margin: 1 },
            $("SubGraphExpanderButton",
              { alignment: go.Spot.Right, margin: 5 }),
            $(go.TextBlock,
              {
                alignment: go.Spot.Left,
                editable: true,
                margin: 5,
                font: "bold 16px sans-serif",
                stroke: "#006080",
				text: "Group"
              },
              new go.Binding("text", "text").makeTwoWay())
          ),  // end Horizontal Panel
          $(go.Placeholder,
            { padding: 5, alignment: go.Spot.TopLeft })
        )  // end Vertical Panel
    ));  // end Group and call to add to template Map
	
	
	// the Diagram's context menu just displays commands for general functionality
	myDiagram.contextMenu =
	$(go.Adornment, "Vertical",
		$("ContextMenuButton",
			$(go.TextBlock, "Undo"),{ 
				click: function(e, obj) {
					e.diagram.commandHandler.undo(); 
				} 
			},
							
			new go.Binding("visible", "", function(o) {
				return o.diagram.commandHandler.canUndo(); 
			}).ofObject()
		),
						
		$("ContextMenuButton",
			$(go.TextBlock, "Redo"),{ 
				click: function(e, obj) {
					e.diagram.commandHandler.redo(); 
				} 
			},
							
			new go.Binding("visible", "", function(o) {
				return o.diagram.commandHandler.canRedo(); 
			}).ofObject()
		),
						
		$("ContextMenuButton",
			$(go.TextBlock, "Save"),{ 
				click: function(e, obj) {
					save(); 
				} 
			}
		),
							
		$("ContextMenuButton",
			$(go.TextBlock, "Load"),{
				click: function(e, obj) {
					load();
				}
			}
		),
						
		$("ContextMenuButton",
			$(go.TextBlock, "Paste"),{
				click: function(e, obj) {
					e.diagram.commandHandler.pasteSelection(e.diagram.lastInput.documentPoint);
				}
			},
			
			new go.Binding("visible", "", function(o) {
				return o.diagram.commandHandler.canPaste(); 
				}
			).ofObject()
		),
						
							
		$("ContextMenuButton",
			$(go.TextBlock, "Delete"),{
				click: function(e, obj) {
					e.diagram.commandHandler.deleteSelection(); 
				}
			}
		)
	);
	
	// the context menu allows users to change the font size and weight,
	// and to perform a limited tree layout starting at that node
	myDiagram.nodeTemplate.contextMenu =
	$(go.Adornment, "Vertical",
					
		//Button Coppy_Node
		$("ContextMenuButton",
			$(go.TextBlock, "Copy"),{
				click: function(e, obj) {
					e.diagram.commandHandler.copySelection();
				}
			}
		),
					
		//Button paste_node
		$("ContextMenuButton",
			$(go.TextBlock, "Paste"),{
				click: function(e, obj) {
					e.diagram.commandHandler.pasteSelection(e.diagram.lastInput.documentPoint);
				}
			}
		),
					
		//Button Cut_Node
		$("ContextMenuButton",
			$(go.TextBlock, "Cut"),{
				click: function(e, obj) {
					 e.diagram.commandHandler.cutSelection(); 
				}
			}
		),
					
		//Button Delete
		$("ContextMenuButton",
			$(go.TextBlock, "Delete"),{
				click: function(e, obj) {
					 e.diagram.commandHandler.deleteSelection();  
				}
			}
		)
	);
	
	
	
	// unlike the normal selection Adornment, this one includes a Button
    myDiagram.nodeTemplate.selectionAdornmentTemplate =
	$(go.Adornment, "Spot",
		$(go.Panel, "Auto",
			$(go.Shape, { 
					fill: null, 
					stroke: "blue", 
					strokeWidth: 2 
				}
			),
			$(go.Placeholder)  // a Placeholder sizes itself to the selected Node
        ),
		
        // the button to create a "next" node, at the top-right corner
        $("Button", {
				alignment: go.Spot.Right,
				click: addNodeAndLink  // this function is defined below
			},
			$(go.Shape, "PlusLine", { 
					width: 6, 
					height: 6 
				}
			)
        ), // end button
		
		$(go.Panel, "Horizontal",{
				alignment: go.Spot.Top, 
				alignmentFocus: go.Spot.Bottom 
			},
			
			$("Button", {
					click: editText,
				},  // defined below, to support editing the text of the node
				
				$(go.TextBlock, "T", { 
						font: "bold 10pt sans-serif", 
						desiredSize: new go.Size(15, 15), 
						textAlign: "center" 
					}
				)
			),
			
			$("Button", {
					click: changeColor // defined below, to support changing the color of the node
				},  
								
					new go.Binding("ButtonBorder.fill", "color", nextColor),
					new go.Binding("_buttonFillOver", "color", nextColor),
				$(go.Shape, { 
						fill: null, stroke: null, desiredSize: new go.Size(15, 15),  
					}
				)
			),
							
			$("Button", { // drawLink is defined below, to support interactively drawing new links
					click: drawLink,  // click on Button and then click on target node
					actionMove: drawLink  // drag from Button to the target node
				},
				
				$(go.Shape, { 
						geometryString: "M0 0 L8 0 8 12 14 12 M12 10 L14 12 12 14" 
					}
				)
			)
		)
	); // end Adornment
	
	function editText(e, button) {
			var node = button.part.adornedPart;
			e.diagram.commandHandler.editTextBlock(node.findObject("TEXTBLOCK")
			);
	}

	// clicking the button inserts a new node to the right of the selected node,
    // and adds a link to that new node
    function addNodeAndLink(e, obj) {
		var adornment = obj.part;
		var diagram = e.diagram;
		diagram.startTransaction("Add State");

		// get the node data for which the user clicked the button
		var fromNode = adornment.adornedPart;
		var fromData = fromNode.data;
		
		// create a new "State" data object, positioned off to the right of the adorned Node
		var toData = { 
			text: "new" 
		};
		
		var p = fromNode.location.copy();
		p.x += 200;
		toData.loc = go.Point.stringify(p);  // the "loc" property is a string, not a Point object
		
		// add the new node data to the model
		var model = diagram.model;
		model.addNodeData(toData);

		// create a link data from the old node data to the new node data
		var linkdata = {
			from: model.getKeyForNodeData(fromData),  // or just: fromData.id
			to: model.getKeyForNodeData(toData),
			text: "transition"
		};
		
		// and add the link data to the model
		model.addLinkData(linkdata);

		// select the new Node
		var newnode = diagram.findNodeForData(toData);
		diagram.select(newnode);

		diagram.commitTransaction("Add State");

		// if the new node is off-screen, scroll the diagram to show the new node
		diagram.scrollToRect(newnode.actualBounds);
    }

	// replace the default Link template in the linkTemplateMap
    myDiagram.linkTemplate =
    $(go.Link,  // the whole link panel
		{
			curve: go.Link.Bezier, adjusting: go.Link.Stretch,
			reshapable: true, relinkableFrom: true, relinkableTo: true,
			toShortLength: 3
        },
		
        new go.Binding("points").makeTwoWay(),
        new go.Binding("curviness"),
		
        $(go.Shape,  // the link shape 
			{ 
				strokeWidth: 1.5 
			}
		),
		  
        $(go.Shape,  // the arrowhead 
			{ 
				toArrow: "standard", 
				stroke: null 
			}
		),
		
        $(go.Panel, "Auto",
			$(go.Shape,  // the label background, which becomes transparent around the edges 
				{
					fill: $(go.Brush, "Radial", { 
							0: "rgb(240, 240, 240)", 
							0.3: "rgb(240, 240, 240)", 
							1: "rgba(240, 240, 240, 0)" 
						}
					),
					stroke: null
				}
			),
			
			$(go.TextBlock, "transition",  // the label text 
				{
				textAlign: "center",
				font: "10pt helvetica, arial, sans-serif",
				margin: 4,
				editable: true  // enable in-place editing
            },
			
            // editing the text automatically updates the model data
            new go.Binding("text").makeTwoWay())
		)
	);
	
	// read in the JSON data from the "mySavedModel" element
    load();
}

// used by nextColor as the list of colors through which we rotate
var myColors = ["lightgray", "lightblue", "lightgreen", "yellow", "orange", "pink", "white", "brown", "gold"];

// used by both the Button Binding and by the changeColor click function
function nextColor(c) {
	var idx = myColors.indexOf(c);
	if (idx < 0) return "lightgray";
	if (idx >= myColors.length-1) idx = 0;
	return myColors[idx+1];
}

function changeColor(e, button) {
	var node = button.part.adornedPart;
	var shape = node.findObject("SHAPE");
	if (shape === null) return;
	node.diagram.startTransaction("Change color");
	shape.fill = nextColor(shape.fill);
	var color = nextColor(shape.fill)
	button["_buttonFillNormal"] = color;  // update the button too
	button["_buttonFillOver"] = color;
	//button.mouseEnter(e, button, '');
	node.diagram.commitTransaction("Change color");
}

function drawLink(e, button) {
	var node = button.part.adornedPart;
	var tool = e.diagram.toolManager.linkingTool;
	tool.startObject = node.port;
	e.diagram.currentTool = tool;
	tool.doActivate();
}

// Show the diagram's model in JSON format
function save() {
	document.getElementById("mySavedModel").value = myDiagram.model.toJson();
}

function load() {
	myDiagram.model = go.Model.fromJson(document.getElementById("mySavedModel").value);
}

function changeTextSize(obj, factor) {
	var adorn = obj.part;
	adorn.diagram.startTransaction("Change Text Size");
	var node = adorn.adornedPart;
	var tb = node.findObject("TEXT");
	tb.scale *= factor;
	adorn.diagram.commitTransaction("Change Text Size");
}

function toggleTextWeight(obj) {
	var adorn = obj.part;
	adorn.diagram.startTransaction("Change Text Weight");
	var node = adorn.adornedPart;
	var tb = node.findObject("TEXT");
	// assume "bold" is at the start of the font specifier
	var idx = tb.font.indexOf("bold");
	if (idx < 0) {
		tb.font = "bold " + tb.font;
	} else {
		tb.font = tb.font.substr(idx + 5);
	}
		adorn.diagram.commitTransaction("Change Text Weight");
}


function saveTextAsFile(){	
	var textToWrite = document.getElementById("mySavedModel").value;
	var textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});
	var fileNameToSaveAs = document.getElementById("inputFileNameToSaveAs").value;
	var downloadLink = document.createElement("a");
	downloadLink.download = fileNameToSaveAs;
	downloadLink.innerHTML = "Download File";
	
	if (window.webkitURL != null){
		// Chrome allows the link to be clicked
		// without actually adding it to the DOM.
		downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
	}else{
		// Firefox requires the link to be added to the DOM
		// before it can be clicked.
		downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
		downloadLink.onclick = destroyClickedElement;
		downloadLink.style.display = "none";
		document.body.appendChild(downloadLink);
	}

	downloadLink.click();
	save();
}

function destroyClickedElement(event){
	document.body.removeChild(event.target);
}
	
function loadFileAsText(){
	var fileToLoad = document.getElementById("fileToLoad").files[0];

	var fileReader = new FileReader();
	fileReader.onload = function(fileLoadedEvent) {
		var textFromFileLoaded = fileLoadedEvent.target.result;
		document.getElementById("mySavedModel").value = textFromFileLoaded;
	};
	fileReader.readAsText(fileToLoad, "UTF-8");
	load();
}
			
//Search node with name_node
function searchDiagram() {  // called by button
	var input = document.getElementById("mySearch");
	if (!input) return;
	input.focus();

	// create a case insensitive RegExp from what the user typed
	var regex = new RegExp(input.value, "i");

	myDiagram.startTransaction("highlight search");
	myDiagram.clearHighlighteds();

	// search four different data properties for the string, any of which may match for success
	if (input.value) {  // empty string only clears highlighteds collection
		var results = myDiagram.findNodesByExample({ text: regex });
		myDiagram.highlightCollection(results);
		// try to center the diagram at the first node that was found
		if (results.count > 0){
			myDiagram.centerRect(results.first().actualBounds);
		}
	}

	myDiagram.commitTransaction("highlight search");
}

$(document).ready(function(){
	$('#imgage_gallery').click(function(){
		$('#thumb').slideToggle('slow');
		$('#Hotkeys_Table').hide('slow');
	});
				
	$('li img').click(function(){
		var imgbg = $(this).attr('dir');
	//console.log(imgbg);
		$('#load').css({backgroundImage: "url("+imgbg+")"});	
							
		});
						
		$('#bgimage').click(function(){
			$('#thumb').hide();
			$('#Hotkeys_Table').hide('slow');
		});
						
		$('#DiagramDiv').click(function(){
			$('#thumb').hide('slow');
			$('#Hotkeys_Table').hide('slow');
		});
						
		$('#Keyboard_Shortcuts').click(function(){
			$('#Hotkeys_Table').slideToggle('slow');
			$('#thumb').hide('slow');
		});
	}
);

$(function() {
	$( "#menu" ).draggable({containment: '.mindMap', cursor: 'move', snap: '.mindMap'});
				
	$('#verborgen_file').hide();
	$('#uploadButton').on('click', function () {
		$('#verborgen_file').click();
	});

	$('#verborgen_file').change(function () {
		var file = this.files[0];
		var reader = new FileReader();
		reader.onloadend = function () {
			$('#load').css('background', 'url("' + reader.result + '")no-repeat center center fixed');
		}
		
		if (file) {
			reader.readAsDataURL(file);
		} else {}
	});
});
