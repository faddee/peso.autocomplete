module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		connect: {
			server: {
				options: {
					keepalive: true
				}
			}
		},
		compass: {
			main: {}
		},
		jshint: {
			files: ['Gruntfile.js', '<%= pkg.name %>.js'],
			options: {
				globals: {
					jQuery: true,
					console: true,
					module: true
				}
			}
		},
		uglify: {
			options: {
				banner: '/*! $.autocomplete a.k.a. <%= pkg.name %> v<%= pkg.version %> <%= pkg.homepage %> */'
			},
			minify: {
				files: {
					'<%= pkg.name %>.min.js': ['<%= pkg.name %>.js']
				}
			}
		},
		watch: {
			js: {
				files: ['<%= jshint.files %>'],
				tasks: ['jshint', 'uglify']
			},
			scss: {
				files: ['scss/**/*.scss'],
				tasks: ['compass']
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-contrib-compass');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');

	grunt.registerTask('test', ['jshint']);

	grunt.registerTask('default', ['jshint', 'compass', 'uglify']);

};
