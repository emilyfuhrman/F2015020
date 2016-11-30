class CreateMap {
	
	constructor(){

		this.data = {};

		this.itineraries = {};
		this.trajectories = {};
		this.intersections = {};
		this.places = {};
		this.authors = {};
		this.continents = {};

		//store screen height and width
		this.width = window.innerWidth;
		this.height = window.innerHeight;

		this.loading = [];

		this.range = [
			new Date(1900,1,1),
			new Date(2000,1,1)
		];
		this.date_start = this.range[0];
		this.date_end = this.range[1];

		this.mode = d3.select('#_01').classed('selected') ? 1 : 2;

		this.ttime = 45;
	}

	loading_manager(_elem){
		var self = this;
		var empty = false;

		//remove name of retrieved JSON document from loading array
		self.loading = self.loading.filter(function(d){ return d !== _elem; });

		if(self.loading.length === 0){
			self.process_data();
			self.setup();
			self.generate();
		}
	}

	get_data(){
		var self = this;
		var datasets = ['author_ids','intersections','itineraries','places','continents'];

		datasets.forEach(function(d){ self.loading.push(d); });
		datasets.forEach(function(d){

			var filepath = 'data_new/test_' +d +'.json';

			d3.json(filepath,function(e,_d){
				if(!e){
					self.data[d] = _d;
					self.loading_manager(d);
				}
			});
		});
	}

	process_data(){
		var self = this;
		
		self.itineraries = self.data.itineraries;
		self.continents = self.data.continents;

		//places
		d3.keys(self.data.places).forEach(function(d){
			var k = d.split(',');
			k[0] = k[0].trim().split(' ').join('-');
			k[1] = k[1].trim().split(' ').join('-');
			k = k.join('_').toLowerCase();
			self.places[k] = self.data.places[d];
			self.places[k].PlaceName = d;
		});

		//authors
		d3.keys(self.data.author_ids).forEach(function(k){
			self.authors[self.data.author_ids[k]] = k;
		});

		//intersections
		self.intersections = self.data.intersections;

		//trajectories
		self.trajectories = {};
	}

	setup(){
		var self = this;
		var tabs = d3.selectAll('.tab');

		this.svg = d3.select('#container')
			.append('svg')
			.attr('width',this.width)
			.attr('height',this.height);

		tabs.on('click',function(d){
			var elem = d3.select(this),
					id = +elem.attr('id').split('_')[1];
			
			self.switch_mode(id);

			tabs.classed('selected',false);
			elem.classed('selected',true);
		});
	}

	generate(){
		if(this.mode === 1){
			this.generate_map();
		} else{
			this.generate_routes();
		}
	}

	generate_map(){
		var self = this;
		var focus = false;
		var sidebar_tabs = d3.selectAll('.sidebar_tab'),
				sidebar_mode = 1;

		//click handlers
		self.svg.on('click',function(d){
			d3.event.stopPropagation();
			unfocus();
			generate_sidebar();
		});
		sidebar_tabs.on('click',function(d){
			var elem = d3.select(this);
			sidebar_tabs.classed('selected',false);
			elem.classed('selected',true);
			sidebar_mode = +elem.attr('id').split('_')[1];
			generate_sidebar();
		});

		//slider
		var scale = d3.time.scale()
			.domain(this.range)
			;
		var scale_axis = d3.svg.axis()
			.orient('right')
			.ticks(20)
			.tickSize(30)
			.tickPadding(12)
			;
		var slide = d3.slider()
			.scale(scale)
			.axis(scale_axis)
			.value([
				scale_value_converter(this.range[1]),
				scale_value_converter(this.range[0])
			])
			.orientation('vertical')
			.margin(0)
			.animate(false)
			.on('slide',function(evt,value){
				var v_1 = value[1] instanceof Date ? value[1] : new Date(value[1]),
						v_2 = value[0] instanceof Date ? value[0] : new Date(value[0]);
				
				self.date_start = scale_value_converter(v_1);
				self.date_end = scale_value_converter(v_2);

				// unfocus();
				update_datebar();
				update();
			})
			.on('slideend',function(evt,value){
				update();
			});

		//the slider library, though lightweight, is flawed
		//use this to convert the date values properly
		function scale_value_converter(_val){
			var s = d3.time.scale()
				.domain(scale.domain())
				.range([0,self.height])
				.nice(d3.time.month)
				;
			return s.invert((self.height -(s(_val))));
		}

		var slider = d3.select('#slider .slider_body').call(slide);
		d3.selectAll('#slider .slider_body .tick').last().style('display','none');
		
		update_datebar();

		//map
		var projection = d3.geo.mercator()
			.scale(180)
			.translate([self.width*0.5,self.height*0.65])
			;
		var path = d3.geo.path().projection(projection);

		var features = topojson.feature(self.continents,self.continents.objects.continents);
		var intersections,
				intersections_unique,

				trajectories;

		var points_g,
				points_backs,
				points_03,
				points_02,
				points_01,
				
				lines_g,
				lines;

		//draw vector map
		var map;
		map = self.svg.selectAll('path.map')
			.data([features]);
		map.enter().append('path')
			.classed('map',true);
		map
			.attr('d',path)
			;
		map.exit().remove();

		function filter_data(){

			//clear objects
			intersections = {};
			intersections_unique = {};
			trajectories = {};

			//INTERSECTIONS
			//filter by date range
			var holder = d3.entries(self.intersections).filter(function(d){
				var n = new Date(d.key);
				return n >=self.date_start && n <=self.date_end;
			});
			//get distinct places
			//slot author IDs into place
			//highest likelihood score wins
			holder.forEach(function(d){
				if(d3.keys(d.value).length >0){
					d3.keys(d.value).forEach(function(_d){
						if(!intersections[_d]){ 
							intersections[_d] = {}; 
							intersections[_d].figures = {}; 
						}
						d.value[_d].forEach(function(__d){
							if(!intersections[_d].figures[__d.AuthorID] || intersections[_d].figures[__d.AuthorID] >__d.Likelihood){
								intersections[_d].figures[__d.AuthorID] = __d.Likelihood;
							}
						});
					});
				}
			});
			//tally up totals
			d3.keys(intersections).forEach(function(d){
				intersections[d].lists = {};
				intersections[d].lists._01 = d3.values(intersections[d].figures).filter(function(_d){ return _d === 1; });
				intersections[d].lists._02 = d3.values(intersections[d].figures).filter(function(_d){ return _d === 2; });
				intersections[d].lists._03 = d3.values(intersections[d].figures).filter(function(_d){ return _d === 3; });
			});
			//make list of unique intersections per place
			holder.forEach(function(d){
				d3.keys(d.value).forEach(function(_d){
					if(!intersections_unique[_d]){ intersections_unique[_d] = []; }
					d.value[_d].forEach(function(__d){
						if(intersections_unique[_d].filter(function(t){ return t.AuthorID === __d.AuthorID && t.EndDate === __d.EndDate; }).length === 0){
							intersections_unique[_d].push(__d);
						}
					});
				});
			});

			//TRAJECTORIES
			holder.forEach(function(d){
				d3.keys(d.value).forEach(function(_d){
					d.value[_d].forEach(function(__d){
						if(!trajectories[__d.AuthorID]){ trajectories[__d.AuthorID] = []; }
						if(trajectories[__d.AuthorID].filter(function(t){ return t.PlaceID === __d.PlaceID && t.EndDate === __d.EndDate; }).length === 0){
							trajectories[__d.AuthorID].push(__d);
						}
					});
				});
			});
			//pair up start and end points
			var tier = 0;
			for(var i=0; i<d3.keys(trajectories).length; i++){
				for(var j=0; j<trajectories[d3.keys(trajectories)[i]].length -1; j++){
					trajectories[d3.keys(trajectories)[i]][j].PlaceID_End = trajectories[d3.keys(trajectories)[i]][j+1].PlaceID;
					trajectories[d3.keys(trajectories)[i]][j].tier = tier;
					tier=(j%2)*10;
				} 
			}
		}

		function generate_lines(){

			lines_g = self.svg.selectAll('g.lines_g')
				.data(d3.entries(trajectories));
			lines_g.enter().append('g')
				.classed('lines_g',true);
			lines_g
				.attr('class',function(d){
					return 'lines_g id_' +d3.keys(self.authors).indexOf(d.key);
				});
			lines_g.exit().remove();

			lines = lines_g.selectAll('path.line')
				.data(function(d){ return d.value.filter(function(_d){ return _d.PlaceID_End; }); });
			lines.enter().append('path')
				.classed('line',true);
			lines
				.attr('d',function(d){
					var source = {},
							target = {};

					//isolate x and y start coordinates using projection
					source = projection([
						self.places[d.PlaceID].Long,
						self.places[d.PlaceID].Lat
					]);

					//isolate x and y end coordinates using projection
					target = projection([
						self.places[d.PlaceID_End].Long,
						self.places[d.PlaceID_End].Lat
					]);

					//this is a path builder -- creates a curved line between points
					//src: http://stackoverflow.com/questions/13455510/curved-line-on-d3-force-directed-tree
					var dx = target[0] -source[0],
							dy = target[1] -source[1],
							dr = Math.sqrt((dx +d.tier) * (dx +d.tier) + (dy +d.tier) * (dy +d.tier));
					return 'M' + source[0] + ',' + source[1] + 'A' + dr + ',' + dr + ' 0 0,1 ' + target[0] + ',' + target[1];
				});
			lines.exit().remove();
		}

		function generate_points(){

			//scale for radii
			var r_scale = d3.scale.linear()
				.domain([0,10])
				.range([0,45]);

			points_g = self.svg.selectAll('g.points_g')
				.data(d3.entries(intersections));
			points_g.enter().append('g')
				.classed('points_g',true);
			points_g
				.attr('transform',function(d){
					var p  = projection([
								self.places[d.key].Long,
								self.places[d.key].Lat
							]),
							px = p[0],
							py = p[1];
					return 'translate(' +px +',' +py +')';
				});
			points_g
				.on('mousemove',function(d){
					d3.select(this)
						.transition()
						.duration(self.ttime)
						.attr('transform',function(_d){
							var p  = projection([
										self.places[_d.key].Long,
										self.places[_d.key].Lat
									]),
									px = p[0],
									py = p[1];
							return 'translate(' +px +',' +py +')scale(1.5)';
						});
				})
				.on('mouseout',function(d){
					d3.select(this)
						.transition()
						.duration(self.ttime/2)
						.attr('transform',function(_d){
							var p  = projection([
										self.places[_d.key].Long,
										self.places[_d.key].Lat
									]),
									px = p[0],
									py = p[1];
							return 'translate(' +px +',' +py +')scale(1)';
						});
				})
				.on('click',function(d){
					d3.event.stopPropagation();
					if(d.key === focus.key){
						unfocus();
					} else{
						focus = d;
						d3.select(this).classed('focus_point',true);
					}
					generate_sidebar();
				});
			points_g.exit().remove();

			//circlebacks (most certain size)
			points_backs = points_g.selectAll('circle.point_back')
				.data(function(d){ return [d.value.lists._01]; });
			points_backs.enter().append('circle')
				.classed('point_back',true);
			points_backs
				.attr('cx',0)
				.attr('cy',0)
				.attr('r',function(d){
					var r_tot = d.length +this.parentNode.__data__.value.lists._02.length +this.parentNode.__data__.value.lists._03.length;
					return r_scale(r_tot);
				});
			points_backs.exit().remove();

			//least certain
			points_01 = points_g.selectAll('circle.point_01')
				.data(function(d){ return [d.value.lists._01]; });
			points_01.enter().append('circle')
				.classed('point_01',true);
			points_01
				.classed('point',true)
				.attr('cx',0)
				.attr('cy',0)
				.attr('r',function(d){
					var r_tot = d.length +this.parentNode.__data__.value.lists._02.length +this.parentNode.__data__.value.lists._03.length;
					return r_scale(r_tot);
				});
			points_01.exit().remove();
				
			//certain
			points_02 = points_g.selectAll('circle.point_02')
				.data(function(d){ return [d.value.lists._02]; });
			points_02.enter().append('circle')
				.classed('point_02',true);
			points_02
				.classed('point',true)
				.attr('cx',0)
				.attr('cy',0)
				.attr('r',function(d){ 
					var r_tot = d.length +this.parentNode.__data__.value.lists._03.length;
					return r_scale(r_tot);
				});
			points_02.exit().remove();
				
			//most certain
			points_03 = points_g.selectAll('circle.point_03')
				.data(function(d){ return [d.value.lists._03]; });
			points_03.enter().append('circle')
				.classed('point_03',true);
			points_03
				.classed('point',true)
				.attr('cx',0)
				.attr('cy',0)
				.attr('r',function(d){
					var r_tot = d.length;
					return r_scale(r_tot);
				});
			points_03.exit().remove();
		}

		function generate_sidebar(){
			var o_scale = d3.scale.linear()
				.domain([0,3])
				.range([0.5,1]);

			if(focus){
				d3.select('#sidebar_title').html('&#8618;&nbsp;' +self.places[focus.key].PlaceName);

				var data = sidebar_mode === 1 ? (intersections_unique[focus.key] || []) : d3.entries(focus.value.figures);
				var items_target = d3.select('#sidebar_items');
				var items,
						items_date;

				items = items_target.selectAll('li.item')
					.data(data);
				items.enter().append('li')
					.classed('item',true);
				items
					.attr('class',function(d){
						var idx = d3.keys(self.authors).indexOf(d.AuthorID);
						return 'item id_' +idx;
					})
					.style('opacity',function(d){
						return o_scale(d.Likelihood);
					})
					.html(function(d){
						return self.authors[d.AuthorID];
					});
				items.exit().remove();

				items_date = items.selectAll('div.item_date')
					.data(function(d){ return [d]; });
				items_date.enter().append('div')
					.classed('item_date',true);
				items_date
					.html(function(d){
						return d.StartDate && d.EndDate ? d.StartDate +'&nbsp;&ndash;&nbsp;' +d.EndDate : d.StartDate ? d.StartDate +'&nbsp;&ndash;' : d.EndDate ? '&nbsp;&ndash;' +d.EndDate : '';
					});
				items_date.exit().remove();

			} else{
				d3.select('#sidebar_title').html('');
				d3.select('#sidebar_items').html('');
			}
		}

		function update_datebar(){
			var f = d3.time.format('%b. %Y');
			d3.select('#date_start').html(f(self.date_start));
			d3.select('#date_end').html(f(self.date_end));
		}

		function update(){
			filter_data();
			generate_lines();
			generate_points();
			generate_sidebar();
		}

		function unfocus(){
			focus = false;
			d3.selectAll('.focus_point').classed('focus_point',false);
		}

		filter_data();
		generate_lines();
		generate_points();
		generate_sidebar();
	}

	generate_routes(){
		var self = this;
	}

	switch_mode(_id){
		this.mode = _id;
		this.tear_down();
		if(this.mode === 1){
			this.generate_map();
		} else{
			this.generate_routes();
		}
	}

	tear_down(){
		var opp = this.mode === 1 ? 2 : 1;
		
		this.svg.selectAll("*").remove();
		d3.select('#slider .slider_body').selectAll('*').remove();
		
		d3.selectAll('.sidebar_tab.selected').classed('selected',false);
		d3.select('.sidebar_tab#sidebar_01').classed('selected',true);

		d3.selectAll('._0' +opp).style('display','none');
		d3.selectAll('._0' +this.mode).style('display','block');

		this.date_start = this.range[0];
		this.date_end = this.range[1];
	}
}

var vis = new CreateMap();
vis.get_data();

//custom sub-selections
d3.selection.prototype.first = function() {
  return d3.select(this[0][0]);
};
d3.selection.prototype.last = function() {
  var last = this.size() - 1;
  return d3.select(this[0][last]);
};