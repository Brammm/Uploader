<?php
/*
* Uploader v1
* Copyright (c) group94 - http://www.group94.com
* Unauthorised use, copying and/or redistributing is strictly prohibited.
*
* JavaScript for processing uploads through conventional file inputs, swfupload or the HTML File API.
* 
* > REQUIRES
* proto.js (v1.4.7+)
* uploader.php
*
* > TO DO 
* - remove files from queue
* - better error alert when there's no files
* - add swfupload support
* - add file dimension check
* - add file restriction in uploader
* - add option to upload all files in one request (at the moment one request per file)
*
* > REFERENCE DOCUMENTATION
* http://www.html5rocks.com/en/tutorials/file/dndfiles/
* http://www.html5rocks.com/en/tutorials/file/xhr2/#toc-send-blob
* http://viralpatel.net/blogs/ajax-style-file-uploading-using-hidden-iframe/
*
*/




// handle file uploading
if(count($_POST) > 0 && count($_FILES) > 0)
{
	$uploader = new Uploader($_POST['config']);
	
	$uploader->upload_file();
}

class Uploader {

	public $conf = array(																// DEFAULT CONFIGURATION
																								// Defined as array on purpose
																								// Overwrite any parameter by passing it when calling new uploader($config);
																								// $config should be an array

		'auto_upload'				=> true,												// start upload of files automatically when a file is selected 

		'append_files'				=> false, 											// append selected/dropped files to the existing array or reset it?

		'use_SWF'					=> false, 											// fallback to swfupload if there's no feature support -- NOT SUPPORTED YET

		'upload_php'				=> 'uploader.php',								// PHP that will handle the file uploading, this file includes default support.
		'upload_path'				=> 'library/',										// upload path relative to the DOCROOT
		'url_path'					=> 'library/',										// URL where the image will reside

		'allowed_filetypes'		=> 'jpg|jpeg|png', 								// Allowed filetypes to upload
		'min_w'						=> 960,												// Minimum and maximum dimensions
		'min_h'						=> 660,
		'max_w'						=> 3500,
		'max_h'						=> 3500,
		'max_files'					=> 1,													// maximum amount of files that can be uploaded
		'start_file_inputs'		=> 1, 												// how many file inputs we start with when there's no support, should not be bigger than max_files
		'drag_n_drop_element'	=> null,												// CSS selector that references the element where you can drop files on.

		'file_input_name'			=> 'files',											// name of the file inputs
		'file_input_id'			=> 'file_%d',										// id of the file inputs, %d gets replaced with an internal counter
		'file_input_class'		=> 'file_input',									// class of the file inputs
		'file_input_prefix'		=> '',												// prefix for any file input
		'file_input_suffix'		=> '',												// suffix for any file input

		'wrapper_prefix'			=> '<div class="uploader_wrapper">',		// prefix for all html elements related to uploading
		'wrapper_suffix'			=> '</div>'											// suffix
	);

	function __construct($config = null)
	{
		if(is_array($config)) {
			$this->conf = array_merge($this->conf, $config);
		}
		
		$this->conf['file_input_counter'] = 0; // internal counter, passed to the javascript
	}
	
	public function get_file_input_html()
	{
		$html = '';
		
		$html .= $this->conf['wrapper_prefix'];
		
		// html for traditional uploading
		$html .= '<div class="uploader_rem_support" id="uploader_classic_inputs">';
	
		for($i=0; $i<$this->conf['start_file_inputs'];$i++)
		{
			if($i < $this->conf['max_files'])
			{
				$id = sprintf($this->conf['file_input_id'], $this->conf['file_input_counter']);
				
				$html .= $this->conf['file_input_prefix'];
				$html .= '<input type="file" name="'.$this->conf['file_input_name'].'[]" id="'.$id.'" class="'.$this->conf['file_input_class'].'" />';
				$html .= $this->conf['file_input_suffix'];
				
				$this->conf['file_input_counter']++;
			}
		}
	
		$html .= '</div>';
		
		// html for multi upload
		$html .= '<div class="uploader_rem_no_support">';

		$html .= $this->conf['file_input_prefix'];

		$id = str_replace('%d', 'multi', $this->conf['file_input_id']);
		$multiple = $this->conf['max_files'] > 1 ? 'multiple' : '';
		$html .= '<input type="file" name="'.$this->conf['file_input_name'].'[]" id="'.$id.'" class="'.$this->conf['file_input_class'].'" '.$multiple.' />';
		$html .= $this->conf['file_input_suffix'];
		$html .= '</div>';
		
		$html .= $this->conf['wrapper_suffix'];
		
		return $html;
	}
	
	public function upload_file()
	{
		$json = array(
			'ok' => false
		);
	
		$files = array();
		if(isset($_FILES[$this->conf['file_input_name']]['name']))
		{ // old skool $_FILES array
			foreach($_FILES[$this->conf['file_input_name']] as $key => $values)
			{
				foreach($values as $index => $value)
				{
					$files[$index][$key] = $value;
				}
			}
		} 
		else
		{ // XMLHttpRequest $_FILES
			$files = $_FILES;
		}

		if(count($files) > 0)
		{
			foreach($files as $file)
			{
				if($file['error'] == UPLOAD_ERR_OK) // no error
				{
					$tmp_name	= $file['tmp_name'];
					$pathinfo	= pathinfo($file['name']);
					$filename	= $pathinfo['filename'];
					$extension	= $pathinfo['extension'];
					$basename	= $pathinfo['basename'];


					// validate the file
					$upload_file = false;
					
					if(strpos($this->conf['allowed_filetypes'], $extension) !== false) {
					
						$image_size = getimagesize($tmp_name);
						if($image_size !== false) {
							// we are dealing with an image, it must fit the min and max dimensions
							$img_w = $image_size[0];
							$img_h = $image_size[1];
							
							$min_w = $this->conf['min_w'];
							$min_h = $this->conf['min_h'];
							$max_w = $this->conf['max_w'];
							$max_h = $this->conf['max_h'];
							
							// if( 
								// ($img_w == $max_w && ($img_h >= $min_h && $img_h <= $max_h))
								// || ($img_h == $max_h && ($img_w >= $min_w && $img_w <= $max_w))
							// ) 
							if(($img_w >= $min_w && $img_w <= $max_w) && ($img_h >= $min_h && $img_h <= $max_h))
							{
								$upload_file = true;
							} else {
								$json['errors'][] = 'INCORRECT_DIMENSIONS';
							}
						
						} else {
							$upload_file = true;
						}
					} else {
						$json['errors'][] = 'INCORRECT_FILETYPE';
					}

					if($upload_file) {
						// let's make sure we have a unique file name
						do 
						{
							$store_filename = uniqid().'.'.$extension;
							$docpath = $this->conf['upload_path'].$store_filename;
						}
						while(is_file($docpath));
						
						// we're suppressing errors as move_uploaded_file tends to throw warnings, which would mess up our json. 
						if(@move_uploaded_file($tmp_name, $docpath)) 
						{
							$url = $this->conf['url_path'].$store_filename;
						
							$json['ok'] 		= true;
							$json['files'][] = array(
								'path'		=> $docpath,
								'url'			=> $url,
								'name'		=> $store_filename,
								'filename'	=> $basename
							);
						} 
						else
						{
							$json['errors'][] = 'FILE_FAILED';
						}
					}
					
				}
			}
		}
		else 
		{
			$json['errors'][] = 'NO_FILES';
		}
		
		// header('Content-type: application/json');
		echo json_encode($json);
	}

} // end of class Uploader

// end of file: upload.php -- nothing below here please