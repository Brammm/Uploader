var UPLOADER = function($conf) {
	if(!$conf) return;
	
	// defining vars per scope, this is better for minifying + gives you better overview of what vars are used.
	var conf = $conf, files = [], uploadedFiles = [], callbacks = {}, UploaderAPI = {}, UploaderHTML = {}, UploaderSWF = {}, API = {}, Common = {}; 
		
	conf.hasFileAPI = window.File && window.FileReader && window.FileList && window.Blob && window.FormData && window.XMLHttpRequest;
	// conf.hasFileAPI = false; // testing

	// if(conf.hasFileAPI)  alert('test yes');
	// else						alert('test no');
	
	// Set up callbacks. 
	// Overwrite callbacks with setCallback
	callbacks = {
		"onFileSelect" :				function(file) { return true;},		// Executed once for every file that's added - must return true or false!
		"onFileSelectComplete" :	function(files) {},						// Executed at the end of the file select
		"onUpload" :					function(file) {},						// Executed when a file is uploaded
		"onUploadComplete" :			function() {},								// Executed at the end of all file uploads
		"onError":						function(error_code) {},				// Executed when an error occurs, specifies error_code
		"onUploadStart":				function(files) {},						// Executed when file upload commences
		"onUploadProgress":			function(file, perc) {},				// Executed when a file progresses
		"onRemove":						function(file) {}							// Executed when a file is removed from the queue
	}
	
	// Define the multiple handlers of code
	
	// UploaderAPI: uses the FileAPI from HTML5
	UploaderAPI = {
		"uploadFile" : function(file) {
			var data = new FormData(), xhr = new XMLHttpRequest();
			
			data.append(file.name, file);
			for(key in conf) {
				var tempKey = String(key), tempVal = String(conf[key]);
			
				data.append('config['+tempKey+']', tempVal);
			}
			xhr.open('POST', conf.upload_php, true);
			xhr.upload.onprogress = function(e) {
				callbacks.onUploadProgress(file, (e.loaded / e.total) * 100);
			};
			xhr.onload = function(e) {

				var json = JSON.parse(e.target.response);
				if(json.ok) {
					var temp = file;
					temp.url = json.files[0].url;
					temp.path = json.files[0].path;
					temp.uploadName = json.files[0].name;
					uploadedFiles.push(temp);
					Common.onUpload(temp);
				} else {
					forEach(json.errors, function(i, errCode) {
						callbacks.onError(errCode);
					});
				}
			};
			xhr.send(data);
		},
		"startUpload" : function() {
			Common.loopFiles(function(id, file) {
				UploaderAPI.uploadFile(file);
			});
		},
		"init" : function() {
				
			// Setup the dnd listeners.
			var dropZone = conf.drag_n_drop_element ? $(conf.drag_n_drop_element) : false;
			if(typeof dropZone == 'array') dropZone = dropZone[0];
			var multiSelect = $('#'+conf.file_input_id.replace('%d', 'multi'));
			
			multiSelect.addEventListener('change', handleFileSelect, false);
	  
			if(dropZone) {
				dropZone.addEventListener('dragover', handleDragOver, false);
				dropZone.addEventListener('drop', handleFileDrop, false);
				
				// handle dragging over body if we're using a div
				if( ! conf.drag_n_drop_body) {
					$('body')[0].addEventListener('dragover', function(ev) {
						ev.stopPropagation();
						ev.preventDefault();
						removeClass(dropZone, 'uploader_dragndrop_inactive');
						removeClass(dropZone, 'uploader_dragndrop_active');
						addClass(dropZone, 'uploader_dragndrop_dragging');
					}, false);
					$('body')[0].addEventListener('dragleave', function(ev) {
						ev.stopPropagation();
						ev.preventDefault();
						removeClass(dropZone, 'uploader_dragndrop_dragging');
						removeClass(dropZone, 'uploader_dragndrop_active');
						addClass(dropZone, 'uploader_dragndrop_inactive');
					}, false);
				}
			}
			
			// Select files via the file input button
			function handleFileSelect(ev) {
				processFiles(ev.target.files); 
				
				// reset the file input, we'll upload with ajax and don't want to send them with the form
				multiSelect.value = ''; 
			}
			
			// what do we do when dragging items over the div
			function handleDragOver(ev) {
				ev.stopPropagation();
				ev.preventDefault();
				
				removeClass(dropZone, 'uploader_dragndrop_inactive');
				addClass(dropZone, 'uploader_dragndrop_active');
			}
			
			// what do we do when we drop files on the div
			function handleFileDrop(ev) {
			
				ev.stopPropagation();
				ev.preventDefault();
				
				// set classes
				removeClass(dropZone, 'uploader_dragndrop_active');
				addClass(dropZone, 'uploader_dragndrop_inactive');
				
				// reset the file input
				multiSelect.value = ''; 
				
				// go
				processFiles(ev.dataTransfer.files); 
			}
			
			// process all the files and output something
			function processFiles(queued) {

				if( ! conf.append_files) {
					Common.loopFiles(function(id, file) {
						Common.removeFile(file);
					});
				}
			
				for (var i = 0, f; f = queued[i]; i++) {
					f.id = i;

					if(callbacks.onFileSelect(f) && i < conf.max_files) {
						files.push(f);
					}
				}
				
				callbacks.onFileSelectComplete(files);
				
				if(conf.auto_upload) UploaderAPI.startUpload();
			}
		},
		"removeFile" : function(file) {
			// don't need to do anything here
		}
	}
	
	// UploaderHTML: Uses conventional HTML to upload files dynamically (using a hidden iframe)
	UploaderHTML = {
		"startUpload" : function() { // let's upload one by one so we don't freak the browser out
		
			var form = $('.'+conf.file_input_class)[0].form,
				form_action = form.getAttribute('action'), 
				iframe = document.createElement("iframe"), 
				iframeId, 
				json;
							
			// Create temporary iframe
			iframe.setAttribute("id", "upload_iframe");
			iframe.setAttribute("name", "upload_iframe");
			iframe.setAttribute("width", "0");
			iframe.setAttribute("height", "0");
			iframe.setAttribute("border", "1");
			iframe.setAttribute("style", "width: 0; height: 0; border: 0");
			
			form.parentNode.appendChild(iframe);
			window.frames['upload_iframe'].name = "upload_iframe";
			iframeId = document.getElementById("upload_iframe");
			
			// add config 
			forEach(conf, function(key, value) {
				var hidden = document.createElement("input");
				hidden.setAttribute('type', 'hidden');
				hidden.setAttribute('name', 'config['+key+']');
				hidden.setAttribute('value', value);
				hidden.setAttribute('class', 'uploader_hidden');
				
				form.appendChild(hidden);
			});
			
			// set event handler for upload
			var eventHandler = function () {

				removeEvent(iframeId, "load", eventHandler);

				// Message from server...
				if (iframeId.contentDocument) {
					json = iframeId.contentDocument.body.innerHTML;
				} else if (iframeId.contentWindow) {
					json = iframeId.contentWindow.document.body.innerHTML;
				} else if (iframeId.document) {
					json = iframeId.document.body.innerHTML;
				}
				
				json = JSON.parse(json);
				tracer(json);
				
				// file is uploaded, response is in json
			
				// Reset the form and delete the iframe...
				setTimeout(function() {
					callbacks.onUploadComplete(json.files);
					
					form.removeAttribute('target');
					form.setAttribute('action', form_action);
				
					forEach($('.uploader_hidden'), function(i, el) {
						form.removeChild(el);
					});
				
					iframeId.parentNode.removeChild(iframeId);
					forEach($('.'+conf.file_input_class), function(i, el) {
						el.value = '';
					});
				}, 250);
			}

			addEvent(iframeId, "load", eventHandler);
			
			form.setAttribute('target', 'upload_iframe');
			form.setAttribute('action', conf.upload_php);
			form.setAttribute("enctype", "multipart/form-data");
			form.setAttribute("encoding", "multipart/form-data");
			
			form.submit();
		},
		"init" : function() {
				lastInput = $('#'+conf.file_input_id.replace('%d', conf.file_input_counter - 1));
		
			var lastInput;
		
			catchChange();
			
			function catchChange() {
				
				lastInput = $('#'+conf.file_input_id.replace('%d', conf.file_input_counter - 1));

				forEach($('.'+conf.file_input_class), function(i, el) {
					// remove previous events
					removeEvent(el, 'change', appendFileInput);
					removeEvent(el, 'change', trackChange); // remove it before adding it again, else we keep on adding the event, causing it to fire multiple times
					
					// add this one again
					addEvent(el, 'change', trackChange);
				});
				
				addEvent(lastInput, 'change', appendFileInput);
			}
			
			function appendFileInput() {
				
				if(conf.file_input_counter < conf.max_files) {
					var id = conf.file_input_id.replace('%d', conf.file_input_counter);
					
					var newInput = createNode(conf.file_input_prefix + '<input type="file" name="' + conf.file_input_name + '[]" id="' + id + '" class="' + conf.file_input_class + '" />' + conf.file_input_prefix);
										
					insertNodeAfter(newInput, lastInput);
					conf.file_input_counter++;
					
					catchChange();
				}
			}
			
			function trackChange(ev) {
				ev = ev || window.event;
				
				var file = {}, input = ev.target || ev.srcElement, id = input.getAttribute('id'), value = input.value;
				
				file.id = id.replace(conf.file_input_id.replace('%d', ''), '');
				file.name = value.replace(/^.*[\\\/]/, '');
				
				if(callbacks.onFileSelect(file)) {
					files.push(file);
				}
				
				callbacks.onFileSelectComplete(files);
				if(conf.auto_upload) UploaderHTML.startUpload();
			}
		}, 
		"removeFile": function(file) {
			$('#'+conf.file_input_id.replace('%d', file.id)).value = '';
		}
	}
	
	// UploaderSWF: Uses swfupload
	UploaderSWF = {
		"init" : function() {
		}
	}
		
	// which approach are we going to take? 
	// Use FileApi if we have support, else use swfupload if enabled. Last resort: file inputs 
	API = conf.hasFileAPI ? UploaderAPI : conf.use_SWF ? UploaderSWF : UploaderHTML;
	
	// Common functions
	Common = {
		"loopFiles" : function(func) {
			for(var i = 0; i < files.length; i++) {
				var file = files[i];
				if(typeof file != 'undefined') func(i, file);
			}
		},
		"init": function() {
			
			var parentClass, elems;
			
			// lets hide some items based on support or not
			remClass = conf.hasFileAPI ? 'uploader_rem_support' : 'uploader_rem_no_support';
			keepClass = conf.hasFileAPI ? 'uploader_rem_no_support' : 'uploader_rem_support';

			// remove elements we don't need
			elems = $('.'+remClass); 
			forEach(elems, function(i, el) {
				el.parentNode.removeChild(el);
			});
			// move the elements we want to keep one up (out of their parent)
			elems = $('.'+keepClass);
			forEach(elems, function(i, el) {
				var remove = true;
				forEach(el.childNodes, function(i, subel) {
					if(subel.nodeType===1) {
						subel.parentNode.parentNode.insertBefore(subel, el);
					} else {
						remove = false;
					}
				});
				if(remove) el.parentNode.removeChild(el); // only remove the elements if there was nothing else in it
			});
			
			// call seperate init's
			API.init();
		},
		"validFiles" : function() {
			if(files.length == 0) return false;
			for(var i = 0; i < files.length; i++) {
				if(typeof files[i] != 'undefined') return true;
			}
			
			return false;
		},
		"startUpload" : function() {
			callbacks.onUploadStart(files); 

			if(Common.validFiles()) {
				API.startUpload();
			} else {
				callbacks.onError('NO_FILES_SELECTED');
			}
		},
		"removeFile" : function(theFile) {
			Common.loopFiles(function(id, file) {
				if(theFile == file) {
					delete files[id];
					files.length--;
					API.removeFile(file);
				}
			});
		},
		"onUpload" : function(file) {
			callbacks.onUpload(file);
			Common.removeFile(file);
			if(files.length == 0) {
				callbacks.onUploadComplete(uploadedFiles);
			}
		}
	}
	
	// initialize!
	Common.init();
	
	// expose public methods.
	return {
		"hasSupport" : function() {
			return conf.hasFileAPI ? true : false;
		},
		"startUpload" : function() {
			Common.startUpload();
		},
		"setCallback" : function(callback, func) {
			// setting setCallback up like this allows us to set different callbacks with one function call.
			switch(typeof callback) {
				case 'string': 
					callbacks[callback] = func;
				break;
				case 'object': 
					forEach(callback, function(call, func) {
						callbacks[call] = func;
					});
				break;
			}
		},
		"removeFile" : function(id) {
			var file = files[id];
			Common.removeFile(file);
			callbacks.onRemove(file);
		},
		"getFiles" : function() {
			return files;
		}
	}

};