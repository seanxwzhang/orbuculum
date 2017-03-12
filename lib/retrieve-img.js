/** The functions in this file are used to construct a google map
and call google api to get all kinds of data, such as streetview, 
nearest road.
*/

var earthRadius = 6378137;
var APIKey = 'AIzaSyCCSIanF_npOtptuVIacA2WBfJ3dADCJDM';

//starting longitude and latitude
var myLatLng = {lat: 34.062587,  lng: -118.445364};
var newLatLng ={lat: 34.062587,  lng: -118.445364};

var map;
var marker;
var mapDiv = document.getElementById('map');

var pos_y; // variables for storing image url
var neg_y;
var pos_x;
var neg_x;
var pos_z;
var neg_z;
var cubeMapImg = [];
var input = document.getElementById('pac-input');

var autocomplete;
var imgEvent = new Event('imgready');

var vcEvent = new Event('vcready');

/**
 * This function initial the google map by creating a google map and creating a marker
 */
function initMap() {
    map = new google.maps.Map(mapDiv, {
        center:  myLatLng,
        zoom: 16,
		streetViewControl: false
        });
		
	marker = new google.maps.Marker({
          position: myLatLng,
          map: map,   
		  draggable: true
        });	

	//add a event listener to achieve the location of the marker when the users stops dragging it	
	marker.addListener('dragend', function() 
	{
    	newLatLng = marker.getPosition().toJSON();
		retrieveSV(newLatLng);		
	});
		
	//a new autocomplete object for place searches
	autocomplete = new google.maps.places.Autocomplete(input);
	
	//add an event listener to know when a new place is clicked 
	autocomplete.addListener('place_changed', function() {         
        var place = autocomplete.getPlace();
        if (!place.geometry) return;
		newLatLng = place.geometry.location.toJSON();
		retrieveSV(newLatLng);
	});
	
	//add an event listener to know when to move the marker
	mapDiv.addEventListener('keydown',function(e){
		moveLocation(e);		
	});
	
	//add an event listener to know when the voice input is ready
	mapDiv.addEventListener('vcready',function(){
		var service = new google.maps.places.AutocompleteService();
		var temp = {input: final_transcript};
		service.getQueryPredictions(temp, handleQuery);
	});
	
	//set the initial starting image which is at westwood
	//6 urls of images in the array are orderd as sky,ground,north,east,south,west
	cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,0,90,APIKey));
	cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,0,-90,APIKey));
	cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,0,0,APIKey));
	cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,90,0,APIKey));
	cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,180,0,APIKey));
	cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,270,0,APIKey));
	setImage();
}

/**
 * This function check the places prediction returned from the voice input and
 * take out the first place and move the map to that place.
 * @param predictions - the predictions returned by the google api
 * @param querystatus - the status of the query
 */
function handleQuery(predictions,querystatus){
	if (querystatus != google.maps.places.PlacesServiceStatus.OK) {
      alert(querystatus);
      return;
    }
	
	if(predictions.length>0){
		var res_placeid = predictions[0].place_id;
		var service = new google.maps.places.PlacesService(map);
		service.getDetails({
          placeId: res_placeid
        }, function(place, status) {
				if (status === google.maps.places.PlacesServiceStatus.OK) {					
					newLatLng = place.geometry.location.toJSON();
					retrieveSV(newLatLng);
				}
			}
		);
	}
}

/**
 * this function assign all 6 new image urls to the global variable and dispatch an event to signal that the images are ready
 */
function setImage(){
    pos_y = cubeMapImg[0];
	neg_y = cubeMapImg[1];
	neg_z = cubeMapImg[2];
	pos_x = cubeMapImg[3];
	pos_z = cubeMapImg[4];
	neg_x = cubeMapImg[5];
	mapDiv.dispatchEvent(imgEvent);
}

/**
 * this function handles the keyboard input from user
 * user can use w,a,s,d to move the marker on the map
 * @param e - the event object
 */
moveLocation = function(e){
	e = e || window.event;
	if(e.keyCode == 65){
		newLatLng = moveMarker("w",myLatLng.lat,myLatLng.lng);
		retrieveSV(newLatLng);

		
	} // left
    else if(e.keyCode == 87){
		newLatLng = moveMarker("n",myLatLng.lat,myLatLng.lng);
		retrieveSV(newLatLng);

	} // up
    else if(e.keyCode == 68){
		newLatLng = moveMarker("e",myLatLng.lat,myLatLng.lng);
		retrieveSV(newLatLng);

	} // right
    else if(e.keyCode == 83){
		newLatLng = moveMarker("s",myLatLng.lat,myLatLng.lng);
		retrieveSV(newLatLng);
	}   // down
	
}

/**
 * this function call the nearest road google api to get a location that is on the nearest road of the given location
 * @param LatLng - the object contain the latitude and longitude of a location
 */
function retrieveSV(LatLng){	
	getJSON(formUrlRoad(LatLng.lat,LatLng.lng,APIKey),handleRoadRes);
}

/**
 * this function handle the nearest google api when it returns, and call streetview api
 * @param roadRes - the result JSON object returned by the road api
 */
function handleRoadRes(roadRes){
	if(!(Object.keys(roadRes).length === 0 && roadRes.constructor === Object)){
		newLatLng.lat = roadRes.snappedPoints[0].location.latitude;
		newLatLng.lng = roadRes.snappedPoints[0].location.longitude;
	} 
	getJSON(formUrlSV(true,newLatLng.lat,newLatLng.lng,90,0,0,APIKey),handleSVRes);
}

/**
 * this function handles the return of street view api
 * @param res - the JSON object return by the street view api
 */
function handleSVRes(res){
	//if the place indeed have a streetview
	if(checkStatus(res)){
		//we move everything to that new place
		newLatLng.lat = res.location.lat;
		newLatLng.lng = res.location.lng;
		myLatLng = newLatLng;
		map.panTo(myLatLng);
		marker.setPosition(myLatLng);
		
		//update the array with url, you can use this array to initiate texture
		cubeMapImg = [];
		cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,0,90,APIKey));
		cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,0,-90,APIKey));
		cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,0,0,APIKey));
		cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,90,0,APIKey));
		cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,180,0,APIKey));
		cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,270,0,APIKey));
		setImage();
	} else {
		//we stay at old place if the streetview is not available
		map.panTo(myLatLng);
		marker.setPosition(myLatLng);
	}
}

/** 
 * this fucntion forms the url for the streetview api
 * @param meta - if meta is true, we return url to query meta data for a street view
 * @param locLat - the latitude of the location to query
 * @param locLng - the longitude of the location to query
 * @param fov - the fov of the streetview
 * @param heading - the heading angle of the streetview
 * @param pitch - the pitch angle of the streetview
 * @param apiKey - the google api key
 */
function formUrlSV(meta,locLat,locLng,fov,heading,pitch,apiKey){
	if(meta == false){
		return "https://maps.googleapis.com/maps/api/streetview?size=512x512&location=" + locLat + "," + locLng + "&fov=" + fov + "&heading=" + heading + "&pitch=" + pitch + "&key=" + apiKey;
	}
	else{
		return "https://maps.googleapis.com/maps/api/streetview/metadata?size=512x512&location=" + locLat + "," + locLng + "&fov=" + fov + "&heading=" + heading + "&pitch=" + pitch + "&key=" + apiKey; 
	}
}

/** 
 * this function forms the url for the nearest road api
 * @param locLat - the latitude of the location to query
 * @param locLng - the longitude of the location to query
 * @param apiKey - the google api key
 */
function formUrlRoad(locLat,locLng,apiKey){
	return 	"https://roads.googleapis.com/v1/nearestRoads?points=" + locLat + "," + locLng + "&key=" + apiKey;
}

/** 
 * this function calculates the position that will be moved with each key press on the keyboard input w,a,s,d
 * @param dir - the direction to move the marker
 * @param loclat - the latitude of the current location 
 * @param loclng - the longitude of the current location 
 */
function moveMarker(dir,loclat,loclng){
	if(dir == "n"){
		return {lat:(loclat+3000/(Math.PI*earthRadius)), lng:loclng}
	}
	else if (dir == "s"){
		return {lat:(loclat-3000/(Math.PI*earthRadius)), lng:loclng}
	}
	else if (dir == "e"){
		return {lat:loclat,lng:(loclng+3000/(Math.PI*earthRadius*Math.cos(Math.PI*loclat/180)))}
	}
	else{
		return {lat:loclat,lng:(loclng-3000/(Math.PI*earthRadius*Math.cos(Math.PI*loclat/180)))}
	}	
}

/**
 * this function takes and url and a callback function as input to access the url and get the JSON results from it
 * then do something with the callback function
 * @param url - the url to query
 * @param callback - the callback function to call after retrieving the results
 */
var getJSON = function(url,callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.onload = function() {
      var status = xhr.status;
      if (status == 200) {		 
        callback(xhr.response);
      } else {
        alert('Something went wrong: ' + status);
      }
    };
    xhr.send();
};

/**
 * This function examines the JSON return from query and return true if image is available and false if not
 * @param data - the JSON result from the streetview metadata query
 */
function checkStatus(data){
	return data["status"] == "OK";
}

