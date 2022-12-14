/** Global starting points in coordinate form. Accessed throughout recursive calls to findGatheringPoint */
var initialPointOne;
var initialPointTwo;
var addresses;
/** 
 *  Address of the gathering point, does not change until user clicks gather again. Needed in many functions
 *  so it is kept global to avoid passing variables between functions in the promise chain unnecessarilyso it is kept global to avoid passing variables between functions in the promise chain unnecessarily
 *
 */
var gatheringPlaceAddress;
/* Methods of transport do not change kept global for the same reason as the gatheringPlaceAddress*/
var methodTransportOne;
var methodTransportTwo;
/* The following variables must be global in order to remove them from the map when a users clicks pick me another*/
var polylineOne;
var polylineTwo;
var markerOne;
var markerTwo;
var markerLabelOne;
var markerLabelTwo;
var gatherMarker;

/** findGatheringPoint recursion counter. Places a upper limit on the number of iterations of our binary search.
    Higher number of allowed attempts makes the gathering point more accurate, but takes more time */
var maxAttempts = 14;
var numAttempts;

$(document).ready(function () {

    /** this function provides google 
    autocomplete of addresses */

    $(".typeahead").typeahead({
        minLength: 2,
        highlight: true,
    },
    {
        source: getAutocompleteSuggestions,
        displayKey: 'description',
    });

    // this creates event listener for gather button
    $("#gather_button").on('click', function(evt) {
        numAttempts = 0;
        evt.preventDefault();
        $("#gather_button").prop('disabled',true);
        $("#gather_button").text("Loading...");
        methodTransportOne = $("input:radio[name=transport_radio1]:checked").val();
        methodTransportTwo = $("input:radio[name=transport_radio2]:checked").val();
        addresses = getAddressesFromForm();
        // points is an array of values from our form inputs
        // makes coordinates from addresses
        makeCoordinates(addresses[0])
        .then(function(latLonPointOne) {
            /**
            * this function converts coordinates to addresses
            *
            * @param {latLonPointOne} <integer> coordinate
            * @return {addresses} <array> addresses, strings
            *
            */
            initialPointOne = latLonPointOne;
            return makeCoordinates(addresses[1])
            .then(function(latLonPointTwo) {
                /**
                * this function converts coordinates to addresses
                *
                * @param {latLonPointTwo} <integer> coordinate
                * @return {addresses} <array> addresses, strings
                *
                */
                initialPointTwo = latLonPointTwo;
                return [latLonPointOne, latLonPointTwo];
            });
        })
        .then(function(latlons) {
            /**
            * this function takes latlons and finds 
            * initial simple geographical midpoint between them
            * 
            * @param {latlons} <array> latitudes & longitudes
            * @return {initialMid} <integer> coordinate of geo-midpoint
            */
            latLonPointOne = latlons[0];
            latLonPointTwo = latlons[1];
            var initialMid = findMidPoint(latLonPointOne, latLonPointTwo);
            if (latLonPointOne, latLonPointTwo) {
                return findGatheringPoint(initialPointOne, initialPointTwo, initialMid, methodTransportOne, methodTransportTwo);
            } else {
                console.warn("Error with latlon creation");
            }

        })
        .then(function(gatheringPoint) {
            /**
            * this is the returned function from gathering point
            *
            * @param {gatheringPoint} <integer> coordinate between two points
            * @return {businessPlaceID} <string> returns Google Maps Place ID
            *
            */
            return findBusiness(gatheringPoint);
        })
        .then(function(businessPlaceID){
            /**
            * takes returned businessPlaceID to use in displayPlaceInfo function 
            *
            * @param {businessPlaceID} <string> returned Google Maps Place ID
            * @return {businessPlaceID} <string> to be used in displayPlaceInfo function 
            *
            */
            return displayPlaceInfo(businessPlaceID);
        })
        .then(function(placeAddress){
            /**
            * takes placeAddress from displayPlaceInfo in order to pass it to
            * getRouteCoordinates
            *
            * @param {placeAddress} <string> address of a business
            * @return {placeAddress} <string>
            */
            gatheringPlaceAddress = placeAddress;
            return getRouteCoordinates(gatheringPlaceAddress, addresses[0], methodTransportOne);

        })
        .then(function(routeCoordinatesOne) {
            /**
            * takes routeCoordinatesOne from getRouteCoordinates and returns next function which 
            * gets the next set of routeCoordinates
            *
            * @param {routeCoordinatesOne} <array> array of coordinates that make up a route
            * @return 
            */
            return getRouteCoordinates(gatheringPlaceAddress, addresses[1], methodTransportTwo)
            .then(function(routeCoordinatesTwo) {
                return [routeCoordinatesOne, routeCoordinatesTwo];
            });
        })
        .then(function(routeCoordinatesArray) {
            /**
            * takes routeCoordinates, both sets from both origin points
            *
            * @param {routeCoordinates} <array> array of coordinates
            * @return {routeCoordatinesOne, calls getRouteCoordinates with placeAddress, addresses[1], methodTransportTwo}
            */
            return displayMap(routeCoordinatesArray);
        })
        .catch(function (error) {
            /**
            * catches errors in the main promises chain and console logs them
            *
            * @param {error} <string> description of error in the main promises chain
            */
            console.warn("Main Chain Error: " + error);
            $("#gather_button").prop('disabled',false);
            $("#gather_button").text("Find meeting place!");
        });
    });
});

/**
 * @return <array> an array of addresses(strings) gathered from each input of our form.
 *
 * Note : This function must be modified when more location inputs
 * are added.
 *
 */
function getAddressesFromForm() {
    var points = [];
    var locationOne = $("#location_one").val();
    var locationTwo = $("#location_two").val();
    points.push(locationOne, locationTwo);
    return points;
}

/**
 *  Get Autocomplete suggestions. Uses Google Places AutocompleteService to search 
 *  for known addresses that match the given query
 *
 *  @param {query} <string> the input to suggest autocomplete matches against. e.g: "123 Main St"
 *  @param {cb} a callback to deliver the potential matches. Takes a single array argument of matches
 *  @return {null|predictions} null or prediction from Google Maps Autocomplete
 */
function getAutocompleteSuggestions(query, callback) {
    var service = new google.maps.places.AutocompleteService();
    service.getQueryPredictions({ input: query }, function(predictions, status) {
        if (status != google.maps.places.PlacesServiceStatus.OK) {
            return;
        }
        return callback(predictions);
    });
}

/**
 *  Takes an address and makes a coordinate out of it
 *  
 *
 *  @param {target} <string> address to become a coordinate
 *  @return {latlon} <array> array of coordinates(integers)
 */
function makeCoordinates(target) {
    var deferred = Q.defer();

    var latlon=[];
    var geocoder = new google.maps.Geocoder();

    geocoder.geocode( { 'address': ""+target}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            latlon[0]=results[0].geometry.location.lat();
            latlon[1]=results[0].geometry.location.lng();

            deferred.resolve(latlon);

        } else {
            console.warn("Geocode was not successful for the following reason: " + status);
            deferred.reject(new Error(status));
            $("#gather_button").prop('disabled',false);
            $("#gather_button").text("Finding meeting place!");
        }
    });

    return deferred.promise;
}

/**
 *  Finds midpoint between any two places.
 *  Uses simple math to find this midpoint rather than the great circle midpoint.
 *  Reasons for not using great circle midpoint: it is only useful if the two points
 *  are > 250 miles from each other, which is not what this app is intended for.
 *  Also, the midpoint is reset in the gathering point function, due to traveling times
 *  so the midpoint is only an initial starting place.
 *
 *  @param {pointOne} <object> this is the first place, must be in coordinate form for math
 *  @param {pointTwo} <object> this is the second place, must be in coordinate form for math
 *  @return {intialMid} <integer> this is the simple, geo midpoint 
 */
function findMidPoint(pointOne, pointTwo) {
    var latOne = pointOne[0];
    var lonOne = pointOne[1];
    var latTwo = pointTwo[0];
    var lonTwo = pointTwo[1];
    var latitudeMid = ( (latOne + latTwo) / 2);
    var longitudeMid = ( (lonOne + lonTwo) / 2);

    var initialMid = [latitudeMid, longitudeMid];

    return initialMid;
}

/**
 *  Finds best gathering point between two places, as far as time to reach a midpoint
 *  
 *  @param {pointOne} integer, must be in coordinate form for math, first location
 *  @param {pointTwo} integer, must be in coordinate form for math, second location
 *  @param {initialMid} integer, coordinate, initial midpoint that is redefined in this recursive function
 *  @param {methodTransportOne} string, taken from form, method of transport for first user
 *  @param {methodTransportTwo} string, taken from form, method of transport for second user
 *  @return {gatheringPoint} most optimal place for two people to meet, spend equal amounts of time getting there
 */

function findGatheringPoint(pointOne, pointTwo, initialMid, methodTransportOne, methodTransportTwo) {
    numAttempts++;
    var deferred = Q.defer();

    return calculateDuration(initialPointOne, initialMid, methodTransportOne)
    // calculates duration between the first point and initial mid (reset in recursive function)
    .then(function(durationOne) {
        return calculateDuration(initialPointTwo, initialMid, methodTransportTwo)
        // calculates duration between the first point and initial mid (reset in recursive function)
               .then(function(durationTwo) {
                // after both durations have been found, returns them
                    return [durationOne, durationTwo];
               });
    })
    .spread(function(durationOne, durationTwo) {
        // Pulls apart the two durations for comparison
        console.log("Duration of trip for first person: " + durationOne);
        console.log("Duration of trip for second person: " + durationTwo);
        console.log("Difference in duration: " + Math.abs(durationOne - durationTwo));
        var tolerance = 0.05 * ((durationOne + durationTwo) / 2);

        // methodTransportOne = $("input:radio[name=transport_radio1]:checked").val();
        // methodTransportTwo = $("input:radio[name=transport_radio2]:checked").val();

        /**
         *  Google sets a strict limit on how many Directions API requests are 
         *  allowed in a certain amount of time so this if statement checks if transit is used as both 
         *  methods of transit and if so, the amount of maxAttempts is lowered to four to stay 
         *  within the Google Maps Directions API threshold
         */

        if (methodTransportOne === 'TRANSIT' && methodTransportTwo === 'TRANSIT') {
            maxAttempts = 4;
            if ((Math.abs(durationOne - durationTwo) <= tolerance) || numAttempts >= maxAttempts) {
                if (numAttempts >= maxAttempts) {
                    console.warn("Stopped findGatheringPoint after max attempts reached");
                }
                // if the coordinate meets all requirements, then use it as gathering point
                deferred.resolve(initialMid);
                return deferred.promise;
            }
            else if (durationOne > durationTwo) {
                /** if duration one is greater, move initialMid to between initialMid and pointOne
                 * by passing it into findMidPoint
                 */
                newMidpoint = findMidPoint(pointOne, initialMid);
                return findGatheringPoint(pointOne, initialMid, newMidpoint, methodTransportOne, methodTransportTwo);
            }
            else {
                /** if duration two is greater, move initialMid to between initialMid and pointTwo
                 * by passing it into findMidPoint
                 */
                newMidpoint = findMidPoint(pointTwo, initialMid);
                return findGatheringPoint(initialMid, pointTwo, newMidpoint, methodTransportOne, methodTransportTwo);
            }
        }
        /**
         * Google sets a strict limit on how many Directions API requests are 
         *  allowed in a certain amount of time so this if statement checks if transit is used 
         *  and if it is in at least once case, the amount of maxAttempts is lowered to seven 
         *  to stay within the Google Maps Directions API threshold
         */

        else if (methodTransportOne === 'TRANSIT' || methodTransportTwo === 'TRANSIT') {
            maxAttempts = 7;
            if ((Math.abs(durationOne - durationTwo) <= tolerance) || numAttempts >= maxAttempts) {
                if (numAttempts >= maxAttempts) {
                    console.warn("Stopped findGatheringPoint after max attempts reached");
                }
                // if the coordinate meets all requirements, then use it as gathering point
                deferred.resolve(initialMid);
                return deferred.promise;
            }
            else if (durationOne > durationTwo) {
                /** if duration one is greater, move initialMid to between initialMid and pointOne
                 * by passing it into findMidPoint
                 */
                newMidpoint = findMidPoint(pointOne, initialMid);
                return findGatheringPoint(pointOne, initialMid, newMidpoint, methodTransportOne, methodTransportTwo);
            }
            else {
                /** if duration two is greater, move initialMid to between initialMid and pointTwo
                 * by passing it into findMidPoint
                 */
                newMidpoint = findMidPoint(pointTwo, initialMid);
                return findGatheringPoint(initialMid, pointTwo, newMidpoint, methodTransportOne, methodTransportTwo);
            }
        }
        else if ((Math.abs(durationOne - durationTwo) <= tolerance) || numAttempts >= maxAttempts) {
            if (numAttempts >= maxAttempts) {
                console.warn("Stopped findGatheringPoint after max attempts reached");
            }
            // if the coordinate meets all requirements, then use it as gathering point
            deferred.resolve(initialMid);
            return deferred.promise;
            }
            /**
             * the else if and else below constitute the binary search tree
             * that this algorithm uses to find optimal midpoint between two people
             */
            
        else if (durationOne > durationTwo) {
            /** if duration one is greater, move initialMid to between initialMid and pointOne
             * by passing it into findMidPoint
             */
            newMidpoint = findMidPoint(pointOne, initialMid);
            return findGatheringPoint(pointOne, initialMid, newMidpoint, methodTransportOne, methodTransportTwo);
        }
        else {
            /** if duration two is greater, move initialMid to between initialMid and pointTwo
             * by passing it into findMidPoint
             */
            newMidpoint = findMidPoint(pointTwo, initialMid);
            return findGatheringPoint(initialMid, pointTwo, newMidpoint, methodTransportOne, methodTransportTwo);
        }
    })
    .catch(function (error) {
        console.warn("findGatheringPoint Error: " + error);
    });

}

/**
 *  Finds duration of time between two places used in findGatheringPoint function
 *
 *  @param {pointOne} <integer> first place, must be in coordinate form for math
 *  @param {pointTwo} <integer> second place, must be in coordinate form for math
 *  @return {duration} <integer> time between two places
 */
function calculateDuration(pointOne, pointTwo, methodTransport) {
    var deferred = Q.defer();

    pointOne = new google.maps.LatLng(pointOne[0], pointOne[1]);
    pointTwo = new google.maps.LatLng(pointTwo[0], pointTwo[1]);
    

    if (methodTransport !== "TRANSIT") {
        var service = new google.maps.DistanceMatrixService();

        service.getDistanceMatrix(
            {
                origins: [pointOne],
                destinations: [pointTwo],
                travelMode: methodTransport,
                unitSystem: google.maps.UnitSystem.METRIC,
                avoidHighways: false,
                avoidTolls: false,
                durationInTraffic: true,
            }, function(response, status) {
                if (status == google.maps.DistanceMatrixStatus.OK) {
                    // value in this case is seconds, duration is in seconds
                    // checks if that method of transit is possible
                    // if it is not then there will be now duration
                    if (response.rows[0].elements[0].duration === undefined) {
                        alert("Sorry, your form of transportation is not available to your meeting place. Please choose another one.");
                        deferred.reject(new Error(status));
                    }
                    else {
                        var duration = (response.rows[0].elements[0].duration.value);
                        deferred.resolve(duration);
                    }
                }
            });
    }
    else {
        /** Google maps Distance Matrix does not offer transit as a travel Mode
         *
         *
         *
         */
        var directionsService = new google.maps.DirectionsService();

        var request = {

            origin: pointOne,
            destination: pointTwo,
            travelMode: methodTransport,

        };

        directionsService.route(request, function (data, status) {
            if (status == google.maps.DirectionsStatus.OK) {
                // checks if transit is possible, if not duration is undefined
                if (data.routes[0].legs[0].duration === undefined) {
                    alert("Sorry public transit is not available to your gathering point. Please choose another form of transportation.");
                    deferred.reject(new Error(status));
                }
                else {
                    var duration = data.routes[0].legs[0].duration.value;
                    deferred.resolve(duration);
                }
            }
        });
    }

    return deferred.promise;
}

/**
 *  Finds business for people to meet at within a certain range of their equal time midpoint
 *  
 *
 *  @param {gatheringPoint} <integer> this is the equal time midpoint from the findGatheringPoint function, coordinate
 *  @return {placeID} <string> unique id for a business from google places api search
 */


function findBusiness(gatheringPoint) {
    /* sets up index for business search incremented when users want to see another business */
    var businessIndex = 0;
    var deferred = Q.defer();

    var spotToSearch = new google.maps.LatLng(gatheringPoint[0], gatheringPoint[1]);

    // gets type of business users wants from form on the page

    var type = $("input:radio[name=business_option]:checked").val();

    var request = {
        location: spotToSearch,
        // radius: '50000',
        types: [type],
        openNow: true,
        rankBy: google.maps.places.RankBy.DISTANCE
    };


    var service = new google.maps.places.PlacesService(googleMap);
    /**
     * Finds business options near gatheringPoint, and gets info about the business
     * Users are allowed to request next business in the object when they press button
     *
     * Since this search needs to be done each time the button is pressed, and then
     * the map must update as well, this function is kept here to retain its spot in 
     * the promise chain and not made seperate as that would not allow for both the first time
     * a business is found and each time the button is pressed
     * @param {response} <object> JSON object with up to 20 businesses in the radius
     * @param {status} <string> status of whether the function was successful
     * @return {placeID} <string> this is then passed to displayPlaceInfo
     */
    service.nearbySearch(request, function businessOptions(response, status) {
        if (response[businessIndex]){
            var placeObj = (response[businessIndex]);
            var placeID = (response[businessIndex].place_id);
            var placeLat = (response[businessIndex].geometry.location.k);
            var placeLon = (response[businessIndex].geometry.location.B);
            var placeComplete = [placeLat, placeLon];

            deferred.resolve(placeID);

            if (response.length > 1 && businessIndex < response.length){
                $(".next_spot").show();
                $("#next_business").unbind("click");
                $("#next_business").click(function(evt) {
                    evt.preventDefault();
                    businessIndex++;

                    placeID = businessOptions(response, status);
                    displayPlaceInfo(placeID);

                    var gatheringPlaceAddress = response[businessIndex].vicinity;
                    return getRouteCoordinates(gatheringPlaceAddress, addresses[0], methodTransportOne)
                    .then(function(routeCoordinatesOne) {

                        return getRouteCoordinates(gatheringPlaceAddress, addresses[1], methodTransportTwo)
                        .then(function(routeCoordinatesTwo) {
                            return [routeCoordinatesOne, routeCoordinatesTwo];
                        });
                    })
                    .then(function(routeCoordinatesArray) {
                       /**
                        * takes routeCoordinates, both sets from both origin points
                        *
                        * @param {routeCoordinates} <array> array of coordinates
                        * @return {routeCoordatinesOne, calls getRouteCoordinates with placeAddress, addresses[1], methodTransportTwo}
                        */
                        return displayMap(routeCoordinatesArray);
                    });

                });
            }
            return placeID;
        }
        else {
            if (businessIndex > 1){
                alert("Sorry, there are no more " + type + "s near your meeting place.");
                $(".next_spot").hide();
            }
            else {
                alert("Sorry, there is no " + type + " near your meeting place. Maybe try another type of meeting place, or look in a nearby neighborhood.");
                $("#gather_button").prop('disabled',false);
                $("#gather_button").text("Find your meeting place!");
                    // maps gatheringPoint with directions, just no business details as there is no business
                    return getRouteCoordinates(gatheringPoint, addresses[0], methodTransportOne)
                    .then(function(routeCoordinatesOne) {

                        return getRouteCoordinates(gatheringPoint, addresses[1], methodTransportTwo)
                        .then(function(routeCoordinatesTwo) {
                            return [routeCoordinatesOne, routeCoordinatesTwo];
                        });
                    })
                    .then(function(routeCoordinatesArray) {
                       /**
                        * takes routeCoordinates, both sets from both origin points
                        *
                        * @param {routeCoordinates} <array> array of coordinates
                        * @return {routeCoordatinesOne, calls getRouteCoordinates with placeAddress, addresses[1], methodTransportTwo}
                        */
                        return displayMap(routeCoordinatesArray);
                    });
            }
        }
    }); /* end of businessOptions */
    return deferred.promise;
} /* end of findBusiness */

/**
 *  Finds specific info about a business using Google Places Details API
 *  
 *
 *  @param {placeID} placeID from the current business found in the findBusiness function
 *  @return {placeAddress, methodTransportOne, methodTransportTwo} <string> these are used by the display map function
 *  to show directions between each starting point and the place address, according to each method of transport
 */

function displayPlaceInfo(placeID) {
    var placeDetailsArray = [];
    var deferred = Q.defer();
    var request = {
        placeId: placeID,
    };

    var service = new google.maps.places.PlacesService(googleMap);
    service.getDetails(request, function(response, status) {
        var placeInfo = response;
        $(".business").show();
        // this displays the name and makes it a link to the required Google website for the place 
        var type = $("input:radio[name=business_option]:checked").val();
        $("#placeIcon").html("<img class=\"place_icon\" src=\"static/assets/"+ type + "map.png\">");
        $("#placeName").html("<a href=\"" + response.website + "\">" + response.name + "</a>");
        var placeAddress = (response.formatted_address);
        $("#placeAddress").html(placeAddress);
        var placeLat = (response.geometry.location.k);
        var placeLon = (response.geometry.location.B);
        var placeLatLon = [placeLat, placeLon];
        if (response.rating){
            $("#googlePlusRating").html("<a href=\"" + response.url + "\">Google+ Rating: " + response.rating + " out of 5</a>");
        }
        if (response.formatted_phone_number){
            $("#placePhoneNumber").html(response.formatted_phone_number);
        }
        var dayOfWeek = new Date().getDay();
        if (response.opening_hours){

            switch(dayOfWeek) {
                case 0:
                    $("#hoursSunday").html(response.opening_hours.weekday_text[6]);
                    break;
                case 1:
                    $("#hoursMonday").html(response.opening_hours.weekday_text[0]);
                    break;
                case 2:
                    $("#hoursTuesday").html(response.opening_hours.weekday_text[1]);
                    break;
                case 3:
                    $("#hoursWednesday").html(response.opening_hours.weekday_text[2]);
                    break;
                case 4:
                    $("#hoursThursday").html(response.opening_hours.weekday_text[3]);
                    break;
                case 5:
                    $("#hoursFriday").html(response.opening_hours.weekday_text[4]);
                    break;
                case 6:
                    $("#hoursSaturday").html(response.opening_hours.weekday_text[5]);
                    break;
            }
        }
        
        switch (response.price_level) {
            case 1:
                $("#placePriceLevel").html("<strong>$</strong> out of $$$$");
                break;
            case 2:
                $("#placePriceLevel").html("<strong>$$</strong> out of $$$$");
                break;
            case 3:
                $("#placePriceLevel").html("<strong>$$$<strong> out of $$$$");
                break;
            case 4:
                $("#placePriceLevel").html("$$$$ out of $$$$");
                break;
        }

    /**  
     *  other info from places API response that I am not displaying, may want to show later
     *  var placePhotos = (response.photos); photos have photo_reference, height, width
     *  
     *  var placeReviews = response.views 
     *  this is an array of up to five reviews
     *  reviews have a type which indicates what aspect of the place is being reviewed response.reviews[index].aspects.type
     *  reviews[].author_name, author url which links to google+ profile if available
     *  reviews[].text, text/content & reviews[].time, time of review 
     *  
     *  var placeTypes = response.types[], tells you what establishment types google attributes to that location
     */

        deferred.resolve(placeAddress);
        methodTransport = $("input:radio[name=transport_radio1]:checked").val().toLowerCase();

        var addresses = getAddressesFromForm();
        var addressOne = addresses[0].split(' ').join('+');
        var addressTwo = addresses[1].split(' ').join('+');
        placeAddress = placeAddress.split(' ').join('+');

        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            var directionLinkApp = "comgooglemaps://?saddr=&daddr=" + placeAddress + "&directionsmode=" + methodTransport;
            $(".share_links").html("<a href=\""+ directionLinkApp +"\">Open Directions in Google Maps App</a>");
            $(".share_links").show();
        }

        else {
            var directionLinkBrowser = "https://maps.google.com?saddr=Current+Location&daddr=" + placeAddress + "&directionsmode=" + methodTransport;
            $(".share_links").html("<a href=\"" + directionLinkBrowser + "\">Open Directions in Google Maps</a>");
            $(".share_links").show();
        }
    });
    
    return deferred.promise;
}

/**
 *  Gets two arrays of latlon coordinates for display on one unified map
 *  
 *  @param {placeAddress} <string> business address where two people are meeting
 *  @param {originAddress} <string> address from form field
 *  @param {methodTransport} <string> from radio button
 *  @return {routeCoordinates} <array> from directions service  API
 */

function getRouteCoordinates(placeAddress, originAddress, methodTransport) {
    var deferred = Q.defer();
    originAddress = originAddress.split(' ').join('+');
    if (typeof(placeAddress) === 'string') {
        placeAddress = placeAddress.split(' ').join('+');
    }
    else {
        placeAddress =  new google.maps.LatLng(placeAddress[0], placeAddress[1]);
    }

    $("#gather_button").prop('disabled',false);
    $("#gather_button").text("Find your meeting place!");

    var directionsService = new google.maps.DirectionsService();

    var request = {

        origin: originAddress,
        destination: placeAddress,
        travelMode: methodTransport,

    };

    directionsService.route(request, function (data, status){
        if (status == google.maps.DirectionsStatus.OK) {
            var latLonArray = data.routes[0].overview_path;
            var polyline = data.routes[0].overview_polyline;
            deferred.resolve(latLonArray);
        }
        else {
            console.warn("Status in getRouteCoordinates: " + status);
            deferred.reject(new Error(status));
        }
    });
    return deferred.promise;
}

function displayMap(latLonArray) {
    var routeOneLatLonArray = latLonArray[0];
    var gatheringLatLng = routeOneLatLonArray[routeOneLatLonArray.length - 1];
    var gatheringPoint = [gatheringLatLng.lat(), gatheringLatLng.lng()];

    return calculateDuration(initialPointOne, gatheringPoint, methodTransportOne)
    .then(function(durationOneSeconds) {

        return calculateDuration(initialPointTwo, gatheringPoint, methodTransportTwo)
        .then(function(durationTwoSeconds){
            return [durationOneSeconds, durationTwoSeconds];
        });
    })
    .then(function(durationArray) {
        return displayMapWithTravelDuration(latLonArray, durationArray);
    });
}
/**
 *  Gets an array of lat lon coordinates and durations from getRouteCoordinates
 *  
 *  @param {latLonArray} <array> of <array> of <LatLng> from directions service API.
 *                       e.g: latLonArray[0] is an <array> of <LatLng> representing the first route
 *  @param {durationArray} <array> of durations from distance matrix API
 */
function displayMapWithTravelDuration(latLonArray, durationArray) {
    var deferred = Q.defer();

    // if (durationArray[0] > 60 < 3600) {
    //     var durationOne = Math.round(durationArray[0] / 60);
    //     var infoWindowContentOne = "<div id=\"content\" style=\"width:70px;\"><span><img style=\"width: 20px; height: 20px; padding-right: 4px;\" src=\"static/assets/" + methodTransportOne +".svg\"></span><span>" + durationOne + " mins </span></div>";
    // }
    // if (durationArray[0] >= 3600) {
    //     var durationOne = 
    // }


    var durationOneMins = String(Math.round(durationArray[0] / 60));
    var durationTwoMins = String(Math.round(durationArray[1] / 60));

    var infoWindowContentOne = "<div id=\"content\" style=\"width:80px;\"><span><img style=\"width: 20px; height: 20px; padding-right: 4px;\" src=\"static/assets/" + methodTransportOne +".svg\"></span><span>" + durationOneMins + " mins </span></div>";
    var infoWindowContentTwo = "<div id=\"content\" style=\"width:80px;\"><span><img style=\"width: 20px; height: 20px; padding-right: 4px;\" src=\"static/assets/" + methodTransportTwo +".svg\"></span><span>" + durationTwoMins + " mins </span></div>";


    if (markerLabelOne){
        markerLabelOne.setMap(null);
        markerLabelTwo.setMap(null);
    }

    var labelIndexOne = Math.round((latLonArray[0].length)/2);
    var labelIndexTwo = Math.round((latLonArray[1].length)/2);


    markerLabelOne = new google.maps.InfoWindow({
        position: latLonArray[0][labelIndexOne],
        content: infoWindowContentOne,
        });

    markerLabelTwo = new google.maps.InfoWindow({
        position: latLonArray[1][labelIndexTwo],
        content: infoWindowContentTwo,
    });

    markerLabelOne.setContent(infoWindowContentOne);
    markerLabelTwo.setContent(infoWindowContentTwo);

    markerLabelOne.setMap(googleMap);
    markerLabelTwo.setMap(googleMap);

    mapPolyLine(latLonArray[0], true);
    mapPolyLine(latLonArray[1], false);
    mapGatheringPoint(latLonArray[0][((latLonArray[0].length)-1)]);

    // Calculates a bounds for the map view given all the points
    var allLatLng = latLonArray[0].concat(latLonArray[1]);
    var bounds = new google.maps.LatLngBounds();

    for (x = 0; x < allLatLng.length; x++) {
        bounds = bounds.extend(allLatLng[x]);
    }

    // Frame route within map
    googleMap.fitBounds(bounds);

    deferred.resolve();
    return deferred.promise;
}


/**
 *  Gets a Google Maps Directions Service LatLong obj, 
 *  uses it to place gathering point on map
 *  
 *  @param {gatheringPlaceLatLon} <obj> a <LatLng> from directions service API.                     
 *  
 */

function mapGatheringPoint(gatheringPlaceLatLon) {
    if (gatherMarker) {
        gatherMarker.setMap(null);
    }

    var type = $("input:radio[name=business_option]:checked").val();

    var gatherImage = {
        url: "static/assets/"+ type +"map.png",
        size: new google.maps.Size(40, 57),
    };


    gatherMarker = new google.maps.Marker({
        position: gatheringPlaceLatLon,
        icon: gatherImage,
    });

    gatherMarker.setMap(googleMap);

}

/**
 *  Gets an array of lat lon coordinates and isFirstRoute from displayMapWithTravelDuration function
 * 
 *  {latLonArray} <array> of <array> of <LatLng> from directions service API.
 *                       e.g: latLonArray[0] is an <array> of <LatLng> representing the first route                     
 *  {isFirstRoute} <boolean> either true if this is mapping of the first route from location one to midpoint
 *  or false if this is the mapping of the second route from location two to midpoint
 */

function mapPolyLine(LatLngArray, isFirstRoute) {

    var strokeColor;

    if (isFirstRoute) {
        if (polylineOne) {
            polylineOne.setMap(null);   // Remove old polyline
            markerOne.setMap(null);     // Remove old marker
        }
        strokeColor = '#ff8888';
    } else {
        if (polylineTwo) {
            polylineTwo.setMap(null);   // Remove old polyline
            markerTwo.setMap(null);     // Remove old marker
        }
        strokeColor = '#3366FF';
    }

    var imageOriginOne = "static/assets/markerOne.svg";
    var imageOriginTwo = "static/assets/markerTwo.svg";
    
    var markerOrigin;

    var route = new google.maps.Polyline({
        path: LatLngArray,
        geodesic: true,
        strokeColor: strokeColor,
        strokeOpacity: 1.0,
        strokeWeight: 6
    });

    if (isFirstRoute) {
        polylineOne = route;
        markerOne = new google.maps.Marker({
            position: LatLngArray[0],
            icon: imageOriginOne
        });
        markerOrigin = markerOne;
    } else {
        polylineTwo = route;
        markerTwo = new google.maps.Marker({
            position: LatLngArray[0],
            icon: imageOriginTwo
        });
        markerOrigin = markerTwo;
    }

    route.setMap(googleMap);
    markerOrigin.setMap(googleMap);
}




