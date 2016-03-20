//****** Globals ********
var current_place;
var place_list = [];
var map;
var markers = [];
//************************

window.onload = function initMap(){
	map = new google.maps.Map(document.getElementById('map'), {
	      center: {lat: 1.354729, lng: 103.811685}, 
	      zoom: 12
	    });

	var input = (document.getElementById('autocomplete-input'));/** @type {!HTMLInputElement} */
	var dest_list = document.getElementById('destinationlist');
	var optimize_button = document.getElementById('optimize-button');
	var clear_button = document.getElementById('clear-button');
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(optimize_button);
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(clear_button);
	map.controls[google.maps.ControlPosition.TOP_RIGHT].push(dest_list);

	var autocomplete = new google.maps.places.Autocomplete(input);
	autocomplete.bindTo('bounds', map);

	

	autocomplete.addListener('place_changed', function() {
		var infowindow = new google.maps.InfoWindow();
		var marker = new google.maps.Marker({
		  map: map,
		  anchorPoint: new google.maps.Point(0, -29)
		});
		infowindow.close();
		marker.setVisible(false);
		var place = autocomplete.getPlace();
		if (!place.geometry) {
			window.alert("It doesn't seem like you chose a valid location. Please try again.");
			return;
		}

		current_place = place;
		place_list.push(place);
		var entry = document.createElement('li');
    	entry.appendChild(document.createTextNode(place.name));
		dest_list.appendChild(entry);

		// If the place has a geometry, then present it on a map.
		if (place.geometry.viewport) {
			map.fitBounds(place.geometry.viewport);
		} else {
			map.setCenter(place.geometry.location);
			map.setZoom(17);  // Why 17? Because it looks good.
		}
		marker.setIcon(/** @type {google.maps.Icon} */({
			url: place.icon,
			size: new google.maps.Size(71, 71),
			origin: new google.maps.Point(0, 0),
			anchor: new google.maps.Point(17, 34),
			scaledSize: new google.maps.Size(35, 35)
			}));
		marker.setPosition(place.geometry.location);
		marker.setVisible(true);
		marker.addListener('click', function() {
		    infowindow.open(map, marker);
		});

		var address = '';
		if (place.address_components) {
			address = [
			  (place.address_components[0] && place.address_components[0].short_name || ''),
			  (place.address_components[1] && place.address_components[1].short_name || ''),
			  (place.address_components[2] && place.address_components[2].short_name || '')
			].join(' ');
		}

		infowindow.setContent('<div><strong>' + place.name + '</strong><br>' + address);
		infowindow.open(map, marker);
		});

}

function optimizeButton(){
	var points_list = [];
	for(var point = 0; point < place_list.length; point++){
		var tmp = {};
		tmp.lat = place_list[point].geometry.location.lat();
		tmp.lon = place_list[point].geometry.location.lng();
		tmp.cluster = -1;
		points_list.push(tmp);
	}
	console.log("points to optimize:")
	console.log(points_list);
	var start = new Date().getTime();
	var clusters = kmeans(points_list);
	var end = new Date().getTime();
	console.log("Time taken:" + (end-start))
	console.log(clusters);
	for (var i = 0; i < clusters.store.length; i++){
		addMarkerAtPos(clusters.store[i].lat, clusters.store[i].lon);
	}
}

function kmeans(points_list){

	var max_k = 10;
	if (points_list.length < 10) {max_k = points_list.length;}

	var results_list = []

	for (var stage_k = 1; stage_k <= max_k; stage_k++) { //go through every number of k
		var within_k_list = [];
		for (var within_k_index = 0; within_k_index < 100; within_k_index++){
			var finished = false;
			var cluster_list = generateClusterList(points_list, stage_k);
			var num_changes = -1;
			while(num_changes != 0){
				num_changes = 0;
				for (var point_index = 0; point_index < points_list.length; point_index++) {
					var distance_list = []
					for (var k = 0; k < cluster_list.length; k++) {
						distance_list.push(distance(cluster_list[k], points_list[point_index]))
					}
					//find closest cluster
					var closest_index = 0
					for(var i = 0; i < cluster_list.length; i++){
						if (distance_list[i]< distance_list[closest_index]) {closest_index = i;}
					}
					if(points_list[point_index] != -1 && points_list[point_index].cluster != closest_index){num_changes++;}//if no change of cluster then end
					points_list[point_index].cluster = closest_index;
				}

				//move clusters to centroid
				for(var k = 0; k < cluster_list.length; k++){
					var counter = 0;
					cluster_list[k].lat = 0.0;
					cluster_list[k].lon = 0.0;
					for(var point_index = 0; point_index < points_list.length; point_index++){
						if(points_list[point_index].cluster == k){//ensure that only points assigned to cluster k are counted
							cluster_list[k].lat += points_list[point_index].lat;
							cluster_list[k].lon += points_list[point_index].lon;
							counter++;
						}
					}
					cluster_list[k].lat = cluster_list[k].lat / counter
					cluster_list[k].lon = cluster_list[k].lon / counter
				}
			}
			var best_within_k = {};
			best_within_k.store = cluster_list;
			var score = 0.0;
			for(var point_index = 0; point_index < points_list.length; point_index++){
				score += distance(points_list[point_index], cluster_list[points_list[point_index].cluster])
			}
			best_within_k.score = score;
			within_k_list.push(best_within_k);
		}
		//end of kmeans for current k, now create ranking
		var best_k = within_k_list[0];
		for(var i = 0; i < within_k_list.length; i++){
			if (within_k_list.score < best_k.score) {
				best_k.store = within_k_list[i].store;
				best_k.score = within_k_list.score;
			}
		}
		
		results_list.push(best_k);
	}

	results_list.sort(function(a,b) {return (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0);} );
	best_score_index = 0;
	for(var i = 0; i < results_list.length-1; i++){//look for big drop in score; indicates overfitting
		if ((results_list[i].score - results_list[i+1].score) < 0.1 * (results_list[best_score_index].score - results_list[best_score_index+1].score)) {best_score_index = i}
	}
	console.log("results:");
	console.log(results_list);
	return results_list[best_score_index]
}

function distance(a, b){
	return Math.pow(a.lat - b.lat, 2) + Math.pow(a.lon - b.lon, 2);
}

function generateClusterList(points_list, k){
	var result = [];
	for(var i = 0; i < points_list.length; i++){
		var cluster_point = {};
		cluster_point.lat = points_list[i].lat;
		cluster_point.lon = points_list[i].lon;
		result.push(cluster_point);
	}
	return getRandomSubArray(result, k); //use k points to start
}

function getRandomSubArray(original, n){
	var tmp = [];
	for(var i=0; i < original.length; i++){
		var tmp_obj = {};
		tmp_obj.lat = original[i].lat;
		tmp_obj.lon = original[i].lon;
		tmp.push(tmp_obj);
	}
	var swap_index_store = [];
	for(var index = 0; index < tmp.length; index++){
		var swap_index = index + Math.floor(Math.random() * (tmp.length - index));
		swap_index_store.push(swap_index);
		var t = tmp[index];
		tmp[index] = tmp[swap_index];
		tmp[swap_index] = t;
	}
	return tmp.slice(0, n);
}

function addMarkerAtPos(lat, lon){
	var marker = new google.maps.Marker({
	          position: {lat: lat, lng: lon},
	          map: map,
	          title: 'Hello World!'
	        });
	marker.setVisible(true);
	markers.push(marker);
}

function clearMarkers(){
	for (var i = 0; i < markers.length; i++) {
		markers[i].setMap(null);
	}
	markers = [];
}