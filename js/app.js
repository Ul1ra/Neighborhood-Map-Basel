// jshint esversion: 6

// Declare our global variables
let map;
let infoWindow;
let bounds;

// Initiate Google Maps 
function initMap() {
  let basel = {
    lat: 47.5518383,
    lng: 7.5938108
  };
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 15,
    center: basel,
    mapTypeControl: false
  });

  infoWindow = new google.maps.InfoWindow();
  bounds = new google.maps.LatLngBounds();
  ko.applyBindings(new ViewModel());
}

// Handle Map error if map is unable to load
function googleMapsError() {
  alert('There is an error loading the map. Please refresh the page or try again later.');
}

// Doesn't repeat foresquare alert's
let foreSquareAlert = false;

// Connecting markers 
let LocationMarker = function (info) {
  let self = this;

  this.title = info.title;
  this.position = info.location;
  this.street = '';
  this.city = '';

  this.visible = ko.observable(true);

  // Standard marker color as oragne
  let defaultIcon = makeMarkerIcon('FF9E00');

  // On hover change color to cyan
  let highlightedIcon = makeMarkerIcon('00E8FF');

  // Foursquare API credentials
  let clientID = 'FGYJU0GNVOJI3JRWRDK3B2YPOSHBIR5BWHHXQVZ0MJDLJPRL';
  let clientSecret = 'TGVUBOID1KLIUBADAERVHHSXEZPGVADAXXMEWWFGPIFR3JP2';

  // Request informaiton from Foursquare API
  let foresquareSearchURL = 'https://api.foursquare.com/v2/venues/search?ll=' + this.position.lat + ',' + this.position.lng + '&client_id=' + clientID + '&client_secret=' + clientSecret + '&v=20180522' + '&query=' + this.title;

   // JSON request from Foursquare
  $.getJSON(foresquareSearchURL).done(function (result) {
    if(result.response.venues.length > 0 ) {
      let results = result.response.venues[0];
      self.street = results.location.formattedAddress[0] ? results.location.formattedAddress[0] : 'N/A';
      self.city = results.location.formattedAddress[1] ? results.location.formattedAddress[1] : 'N/A';
    } else {
      alert('Could not find entry on forsquare for: ' + info.title);
      console.log(foresquareSearchURL);
    }
  }).fail(function (error) {
    
    // On fail, show error
    console.log(foresquareSearchURL);
    console.log(error);
    if(foreSquareAlert != error.responseJSON.meta.errorDetail) {
      alert('Failed to get additional information from Foresquare: ' + error.responseJSON.meta.errorDetail);
    }
    foreSquareAlert = error.responseJSON.meta.errorDetail;
  });

  // Marker location & info of list (markers.js)
  this.marker = new google.maps.Marker({
    position: this.position,
    title: this.title,
    animation: google.maps.Animation.DROP,
    icon: defaultIcon
  });

  // Filter through markers
  self.filterMarkers = ko.computed(function () {

    // Shows only chosen marker(s)
    if (self.visible() === true) {
      self.marker.setMap(map);
      bounds.extend(self.marker.position);
      map.fitBounds(bounds);
    } else {
      self.marker.setMap(null);
    }
  });

  // InfoWindow appears onclick
  this.marker.addListener('click', function () {
    populateInfoWindow(this, self.street, self.city, infoWindow);
    toggleBounce(this);
    map.panTo(this.getPosition());
  });

  // Highlight marker on mouseover
  this.marker.addListener('mouseover', function () {
    this.setIcon(highlightedIcon);
  });

  // Reverts back to orange when cursor leaves marker
  this.marker.addListener('mouseout', function () {
    this.setIcon(defaultIcon);
  });

  // Shows location info onclick
  this.show = function (location) {
    google.maps.event.trigger(self.marker, 'click');
  };

  // Adds bounce animation onclick of marker
  this.bounce = function (place) {
    google.maps.event.trigger(self.marker, 'click');
  };

};

/* View Model */
let ViewModel = function () {
  let self = this;

  this.searchItem = ko.observable('');

  this.mapList = ko.observableArray([]);

  // For each marker, adds html code into index.html per marker
  markers.forEach(function (location) {
    self.mapList.push(new LocationMarker(location));
  });

  // Shows selected markers dependent on search query
  this.locationList = ko.computed(function () {
    let searchFilter = self.searchItem().toLowerCase();
    if (searchFilter) {
      return ko.utils.arrayFilter(self.mapList(), function (location) {
        let current = location.title.toLowerCase();
        let result = current.includes(searchFilter);
        location.visible(result);
        return result;
      });
    }
    self.mapList().forEach(function (location) {
      location.visible(true);
    });
    return self.mapList();
  }, self);
};

// Populate the infoWindow with info
function populateInfoWindow(marker, street, city, infowindow) {
  if (infowindow.marker != marker) {

    // Clears the infoWindow content to show street view of marker
    infowindow.setContent('');
    infowindow.marker = marker;

    // Let's also make sure the marker is also removed once the infoWindow is closed
    infowindow.addListener('closeclick', function () {
      infowindow.marker = null;
    });
    let streetViewService = new google.maps.StreetViewService();
    let radius = 30;

    // HTML/CSS to infoWindow
    let infoWindowContent = '<h4>' + marker.title + '</h4>' +
      '<p>' + street + "<br>" + city + '<br>' + "</p>";

    // Loads streetView
    let getStreetView = function (info, status) {
      if (status == google.maps.StreetViewStatus.OK) {
        let StreetViewLocationRequest = info.location.latLng;
        let heading = google.maps.geometry.spherical.computeHeading(
          StreetViewLocationRequest, marker.position);

        infowindow.setContent(infoWindowContent + '<div id="pano"></div>');
        let panoramaOptions = {
          position: StreetViewLocationRequest,
          pov: {
            heading: heading,
            pitch: 30
          }
        };
        let panorama = new google.maps.StreetViewPanorama(
          document.getElementById('pano'), panoramaOptions);
      } else {
        infowindow.setContent(infoWindowContent + '<div style="color: red">No Street View Found, please try again.</div>');
      }
    };

    // Use streetView to show closes street view option
    streetViewService.getPanoramaByLocation(marker.position, radius, getStreetView);
    infowindow.open(map, marker);
  }
}

// Toggles bounce animation 
function toggleBounce(marker) {
  if (marker.getAnimation() !== null) {
    marker.setAnimation(null);
  } else {
    marker.setAnimation(google.maps.Animation.BOUNCE);
    setTimeout(function () {
      marker.setAnimation(null);
    }, 1400);
  }
}

// Marker shape
function makeMarkerIcon(markerColor) {
  let markerImage = new google.maps.MarkerImage(
    'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|' + markerColor +
    '|40|_|%E2%80%A2',
    new google.maps.Size(21, 34),
    new google.maps.Point(0, 0),
    new google.maps.Point(10, 34),
    new google.maps.Size(21, 34));
  return markerImage;
}
