# Road Trip Planner
When planning a trip with multiple locations that one wants to visit, one would ask a few questions:
1. Which locations are close enough to one another to visit in one day?
2. How long would it take for me to go from the place I'm staying to all the places I want to go?
3. What is the best order in which to visit these places?

This app aims to answer these questions automatically without requiring the user to do more than 
enter destinations and a home base.

###Features:
1. Make list of travel destinations (e.g tourist attractions)
2. Gather attractions near each other
3. Organize list of destinations by day
4. Find optimal order of visiting each place for each day.

###Technical Stuff:
- Uses Google Places and Directions API
- Uses kmeans clustering to find places which are close by each other.