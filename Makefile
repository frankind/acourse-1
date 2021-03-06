build: clean
	node build/build.js

dev:
	node build/dev-server.js

clean:
	rm -rf dist

dep:
	npm install

database:
	firebase deploy --only database

deploy: build
	firebase deploy
