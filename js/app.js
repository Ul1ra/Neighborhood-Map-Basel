// Let's declare our global variables
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

// Let's handle our map errors
function googleMapsError() {
  alert('Huston, there is an issue with the map! Please refresh the page or try again later');
}

// don't repeat foresquare alert's
let foreSquareAlert = false;

// Let's connect our Model
let LocationMarker = function (info) {
  let self = this;

  this.title = info.title;
  this.position = info.location;
  this.street = '',
    this.city = '',
    this.phone = '';

  this.visible = ko.observable(true);

  // Let's style the markers starting with
  let defaultIcon = makeMarkerIcon('FF9E00');

  // Now let's change the marker colour when the marker is hovered on
  let highlightedIcon = makeMarkerIcon('00E8FF');

  // Let's add the Foursquare API credentials
  let clientID = 'FGYJU0GNVOJI3JRWRDK3B2YPOSHBIR5BWHHXQVZ0MJDLJPRL';
  let clientSecret = 'TGVUBOID1KLIUBADAERVHHSXEZPGVADAXXMEWWFGPIFR3JP2';

  // Let's get the JSON request from foursquare
  let foresquareSearchURL = 'https://api.foursquare.com/v2/venues/search?ll=' 
   + this.position.lat + ',' 
   + this.position.lng 
   + '&client_id=' + clientID 
   + '&client_secret=' + clientSecret 
   + '&v=20180522' 
   + '&query=' + this.title;

  $.getJSON(foresquareSearchURL).done(function (info) {
    let results = info.response.venues[0];
    self.street = results.location.formattedAddress[0] ? results.location.formattedAddress[0] : '';
    self.city = results.location.formattedAddress[1] ? results.location.formattedAddress[1] : '';
    self.phone = results.contact.formattedPhone ? results.contact.formattedPhone : '';
  }).fail(function (error) {
    console.log(foresquareSearchURL);
    console.log(error);
    if(foreSquareAlert != error.responseJSON.meta.errorDetail) {
      alert('Failed to get additional information from Foresquare: ' + error.responseJSON.meta.errorDetail);
    }
    foreSquareAlert = error.responseJSON.meta.errorDetail;
  });

  // Let's create a marker per location of our marker list (markers.js) and add it into our markers array
  this.marker = new google.maps.Marker({
    position: this.position,
    title: this.title,
    animation: google.maps.Animation.DROP,
    icon: defaultIcon
  });

  // Let's filter through our markers
  self.filterMarkers = ko.computed(function () {

    // Let's set the marker and extend it's bounds (showListings)
    if (self.visible() === true) {
      self.marker.setMap(map);
      bounds.extend(self.marker.position);
      map.fitBounds(bounds);
    } else {
      self.marker.setMap(null);
    }
  });

  // Let's create an 'click' event to open an infoWindow when a marker is clicked on
  this.marker.addListener('click', function () {
    populateInfoWindow(this, self.street, self.city, self.phone, infoWindow);
    toggleBounce(this);
    map.panTo(this.getPosition());
  });

  // Let's add a mouseover 'click' event to highlight the icon
  this.marker.addListener('mouseover', function () {
    this.setIcon(highlightedIcon);
  });

  // And when the user no longer hovers on the marker, revert the colour back
  this.marker.addListener('mouseout', function () {
    this.setIcon(defaultIcon);
  });

  // Let's show an item info when the marker is selected from the list (markers.js)
  this.show = function (location) {
    google.maps.event.trigger(self.marker, 'click');
  };

  // Let's add the bounce animation to the item that is selected/clicked on
  this.bounce = function (place) {
    google.maps.event.trigger(self.marker, 'click');
  };

};

// Let's add the ViewModel
let ViewModel = function () {
  let self = this;

  this.searchItem = ko.observable('');

  this.mapList = ko.observableArray([]);

  // Let's add location markers for each marker (markers.js = location{lat, lng})
  markers.forEach(function (location) {
    self.mapList.push(new LocationMarker(location));
  });

  // Let's make the markers appear on the map
  this.locationList = ko.computed(function () {
    let searchFilter = self.searchItem().toLowerCase();
    if (searchFilter) {
      return ko.utils.arrayFilter(self.mapList(), function (location) {
        let str = location.title.toLowerCase();
        let result = str.includes(searchFilter);
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

// Let's populate the infoWindow when a marker is clicked on.
function populateInfoWindow(marker, street, city, phone, infowindow) {
  if (infowindow.marker != marker) {

    // This clears the infoWindow content to give the street view to load
    infowindow.setContent('');
    infowindow.marker = marker;

    // Let's also make sure the marker is also removed once the infoWindow is closed
    infowindow.addListener('closeclick', function () {
      infowindow.marker = null;
    });
    let streetViewService = new google.maps.StreetViewService();
    let radius = 50;

    let windowContent = '<h4>' + marker.title + '</h4>' +
      '<p>' + street + "<br>" + city + '<br>' + phone + "</p>";

    // Once streetView is loaded, compute the position of the streetView image, then it should calculate the heading,
    // and get the panorama from that marker and set the options
    let getStreetView = function (info, status) {
      if (status == google.maps.StreetViewStatus.OK) {
        let nearStreetViewLocation = info.location.latLng;
        let heading = google.maps.geometry.spherical.computeHeading(
          nearStreetViewLocation, marker.position);
        infowindow.setContent(windowContent + '<div id="pano"></div>');
        let panoramaOptions = {
          position: nearStreetViewLocation,
          pov: {
            heading: heading,
            pitch: 30
          }
        };
        let panorama = new google.maps.StreetViewPanorama(
          document.getElementById('pano'), panoramaOptions);
      } else {
        infowindow.setContent(windowContent + '<div style="color: red">No Street View Found, please try again!</div>');
      }
    };

    // Use streetView service to get the closest pov within 30 meters from the location
    streetViewService.getPanoramaByLocation(marker.position, radius, getStreetView);
    
    // Now let's make sure the infoWindow opens on the correct marker
    infowindow.open(map, marker);
  }
}

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

// Let's add colour and shape to our markers
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
