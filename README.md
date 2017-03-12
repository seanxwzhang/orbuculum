# Orbuculum

An orbuculum is a crystal or glass ball and common fortune telling object. In this project, we propose to present street views in an orbuculum with fancy styles and also in an interactive way.

The interactions implemented enable users to control where they want to see (only within the range of Google Streetview's ability) via either voice recognition or straightforward direction control. The orbuculum is placed in a mystical environment with smokes and shadow.

## How to run the project

Just start clone the repository and start a simple http server is enough.

Voice input might require latest chrome.

## Some instructions on the project

* Marker is draggable.

* You can search the place with the search bar and click the place you want to go. Then the Orbuculum will show you.

* You can click on the map and then use w(north),a(west),s(south),d(east) to move the marker along the street.

* You hit click the button or use space to start and stop voice input. To use voice input to search for street view, you should first start voice input by click the button/use space, then speak the location(pure address or the name of the place), and stop the voice input.

## Advance Topic

* Environment Mapping - We use it on the orbuculum to map the streetview.

* Shadow - We create a static shadow for the ball with shadow mapping.

* Advance shader - we create smoke effect and blur effect on the ball with advance shaders.

## Authors

* **Xingan Wang** - 904761242 - wangxgwxg@gmail.com
* **Xiaowen Zhang** - 304761711 - seanzhang@cs.ucla.edu
* **Shuang Zhang** - 804296230 - alanzhang88@ucla.edu

## Acknowledgments

* Generate cube mapping images from panorama - [Salix alba's respone on stackoverflow](http://stackoverflow.com/questions/29678510/convert-21-equirectangular-panorama-to-cube-map)
* Environmental mapping - [Math.hws.edu](http://math.hws.edu/eck/cs424/notes2013/webgl/skybox-and-reflection/skybox-and-env-map.html)
* Shadow mapping tutorials - [IndigoCS webgl tutorials](https://github.com/sessamekesh/IndigoCS-webgl-tutorials/tree/master/Shadow%20Mapping)
* Voice input - [Google's Speech](https://www.google.com/intl/en/chrome/demos/speech.html)
* glMatrix - [Brandon Jones](http://glmatrix.net/)

