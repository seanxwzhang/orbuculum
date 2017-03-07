
//use w a s d to walk
//https://maps.googleapis.com/maps/api/streetview/metadata?size=512x512&location=40.720032,-73.988354&fov=90&heading=0&pitch=0&key=AIzaSyCCSIanF_npOtptuVIacA2WBfJ3dADCJDM
//https://roads.googleapis.com/v1/nearestRoads?points=60.170880,24.942795|60.170879,24.942796|60.170877,24.942796&key=AIzaSyCCSIanF_npOtptuVIacA2WBfJ3dADCJDM
var locLat,locLng;
var earthRadius = 6378137;
var APIKey = 'AIzaSyCCSIanF_npOtptuVIacA2WBfJ3dADCJDM';

//var url = 'https://maps.googleapis.com/maps/api/streetview?size=512x512&location=40.720032,-73.988354&fov=90&heading=0&pitch=0&key=AIzaSyCCSIanF_npOtptuVIacA2WBfJ3dADCJDM';

//westwood 34.062587, -118.445364
var myLatLng = {lat: 34.062587,  lng: -118.445364};
var newLatLng ={lat: 34.062587,  lng: -118.445364};

var map;
var marker;
var mapDiv = document.getElementById('map');
// var skyImg =  document.getElementById('sky');
// var grndImg = document.getElementById('grnd');
// var westImg = document.getElementById('west');
// var eastImg = document.getElementById('east');
// var northImg = document.getElementById('north');
// var southImg = document.getElementById('south');
var pos_y; // variables for storing image url
var neg_y;
var pos_x;
var neg_x;
var pos_z;
var neg_z;
var cubeMapImg = [];
var input = document.getElementById('pac-input');
var autocomplete;

function initMap() {
    map = new google.maps.Map(mapDiv, {
        center:  myLatLng,
        zoom: 16,
		streetViewControl: false
        });
		
	marker = new google.maps.Marker({
          position: myLatLng,
          map: map         
        });	

	marker.addListener('dragend', function() 
	{
    	retrieveSV(marker.getPosition().toJSON());
	});
		

	autocomplete = new google.maps.places.Autocomplete(input);
	//autocomplete.bindTo('bounds', map);
	
	autocomplete.addListener('place_changed', function() {         
        var place = autocomplete.getPlace();
        if (!place.geometry) return;
		retrieveSV(place.geometry.location.toJSON());
		setImage();
	});

	//6 urls of images in the array are orderd as sky,ground,north,east,south,west
	cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,0,90,APIKey));
	cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,0,-90,APIKey));
	cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,0,0,APIKey));
	cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,90,0,APIKey));
	cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,180,0,APIKey));
	cubeMapImg.push(formUrlSV(false,myLatLng.lat,myLatLng.lng,90,270,0,APIKey));
	setImage();
}

function setImage(){
	// skyImg.src = cubeMapImg[0];
	// grndImg.src = cubeMapImg[1];
	// northImg.src = cubeMapImg[2];
	// eastImg.src = cubeMapImg[3];
	// southImg.src = cubeMapImg[4];
	// westImg.src = cubeMapImg[5];	
    pos_y = cubeMapImg[0];
	neg_y = cubeMapImg[1];
	neg_z = cubeMapImg[2];
	pos_x = cubeMapImg[3];
	pos_z = cubeMapImg[4];
	neg_x = cubeMapImg[5];
}

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

function retrieveSV(LatLng){
	
	getJSON(formUrlRoad(LatLng.lat,LatLng.lng,APIKey),handleRoadRes);
/* 	var roadRes = JSONdata;
	if(roadRes == null){console.log("noroad");return false;}
	
	var lat = roadRes.snappedPoints[0].location.latitude;
	var lng = roadRes.snappedPoints[0].location.longtitude;

	getJSON(formUrlSV(true,lat,lng,90,0,90,APIKey));
	var skyRes = JSONdata;
	if(!checkStatus(skyRes)){console.log("no image for sky at" + lat + lng +"\n");return false;}
	getJSON(formUrlSV(true,lat,lng,90,0,-90,APIKey));
	var grndRes = JSONdata;
	if(!checkStatus(grndRes)){console.log("no image for ground at" + lat + lng +"\n");return false;}
	getJSON(formUrlSV(true,lat,lng,90,0,0,APIKey));
	var northRes = JSONdata;
	if(!checkStatus(northRes)){console.log("no image for north at" + lat + lng +"\n");return false;}
	getJSON(formUrlSV(true,lat,lng,90,90,0,APIKey));
	var eastRes = JSONdata;
	if(!checkStatus(eastRes)){console.log("no image for east at" + lat + lng +"\n");return false;}
	getJSON(formUrlSV(true,lat,lng,90,180,0,APIKey));
	var southRes = JSONdata;
	if(!checkStatus(southRes)){console.log("no image for south at" + lat + lng +"\n");return false;}
	getJSON(formUrlSV(true,lat,lng,90,270,0,APIKey));
	var westRes = JSONdata;
	if(!checkStatus(westRes)){console.log("no image for west at" + lat + lng +"\n");return false;}
	
	return true;
 */	
}

function handleRoadRes(roadRes){
	if(!(Object.keys(roadRes).length === 0 && roadRes.constructor === Object)){
		newLatLng.lat = roadRes.snappedPoints[0].location.latitude;
		newLatLng.lng = roadRes.snappedPoints[0].location.longitude;
		getJSON(formUrlSV(true,newLatLng.lat,newLatLng.lng,90,0,0,APIKey),handleSVRes);
	} else {
		map.panTo(myLatLng);
		marker.setPosition(myLatLng);
		setImage();
	}
}

function handleSVRes(res){
	if(checkStatus(res)){
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
		map.panTo(myLatLng);
		marker.setPosition(myLatLng);
		setImage();
	}
}

function formUrlSV(meta,locLat,locLng,fov,heading,pitch,apiKey){
	if(meta == false){
		return "https://maps.googleapis.com/maps/api/streetview?size=512x512&location=" + locLat + "," + locLng + "&fov=" + fov + "&heading=" + heading + "&pitch=" + pitch + "&key=" + apiKey;
	}
	else{
		return "https://maps.googleapis.com/maps/api/streetview/metadata?size=512x512&location=" + locLat + "," + locLng + "&fov=" + fov + "&heading=" + heading + "&pitch=" + pitch + "&key=" + apiKey; 
	}
}

function formUrlRoad(locLat,locLng,apiKey){
	return 	"https://roads.googleapis.com/v1/nearestRoads?points=" + locLat + "," + locLng + "&key=" + apiKey;
}

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

var getJSON = function(url,callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.onload = function() {
      var status = xhr.status;
      if (status == 200) {
		 
        callback(xhr.response);
		console.log(xhr.response);
      } else {
        alert('Something went wrong: ' + status);
      }
    };
    xhr.send();
};


//return true if image is available and false if not
function checkStatus(data){
	return data["status"] == "OK";
}

